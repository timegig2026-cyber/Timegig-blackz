/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType
} from './lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  onSnapshot
} from 'firebase/firestore';
import { searchLocations, reverseGeocode } from './utils/geocoding';
import {
  Locate,
  Navigation,
  AlertCircle,
  Search,
  RefreshCw,
  X,
  Plus,
  PlusCircle,
  Minus,
  Layers,
  Zap,
  CheckCircle2,
  Upload,
  Camera,
  ShieldCheck,
  CreditCard,
  Award,
  Wrench,
  User,
  Building2,
  DollarSign,
  TrendingUp,
  MapPin,
  Users,
  Copy,
  Check,
  FileText,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  LogOut,
  Lock,
  Mail,
  Snowflake,
  Power,
  PowerOff,
  Calendar,
  Clock,
  HelpCircle
} from 'lucide-react';

interface Referral {
  id: string;
  email: string;
  selfieUrl: string;
  idDocName: string;
  idDocUrl?: string;
  popDocName: string;
  popDocUrl?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  date: string;
  activatedPlan: 'user' | 'tenant';
  expiryDate: string;
  isFrozen: boolean;
  referrerEmail: string;
}

interface Gig {
  id: string;
  title: string;
  details: string;
  date: string;
  isImmediate: boolean;
  budget: string;
  location: string;
  lat: number;
  lng: number;
  experience: string;
  creatorEmail: string;
  createdAt: string;
  status: 'Active' | 'Completed' | 'Cancelled';
}

interface UserAccount {
  email: string;
  password: string;
  subscriptionState: 'none' | 'user' | 'tenant';
  selfieImage: string | null;
  idDocName: string | null;
  idDocUrl?: string | null;
  popDocName: string | null;
  popDocUrl?: string | null;
  isDisabled: boolean;
  isFrozen: boolean;
  isOnline?: boolean;
  referredBy: string | null;
  firstName?: string;
  lastName?: string;
  dob?: string;
  contact?: string;
  location?: string;
  lat?: number;
  lng?: number;
  educationLevel?: string;
  workingTrade?: string;
  workingTrades?: string[];
  gigCategories?: string[];
  experience?: string[];
  references?: string[];
  profileLastUpdated?: string;
  isLocked?: boolean;
}

// Fix Leaflet marker icons for production builds (Vercel etc)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function App() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const authMapContainerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const searchMarkerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Authentication & Session State with localStorage persistence
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'authenticated'>(() => {
    return localStorage.getItem('saved_auth') ? 'authenticated' : 'signup';
  });
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [registeredUsers, setRegisteredUsers] = useState<UserAccount[]>(() => {
    try {
      const saved = localStorage.getItem('registered_users');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Error parsing registered_users:', e);
      return [];
    }
  });

  const [currentEmail, setCurrentEmail] = useState<string>(() => {
    try {
      return localStorage.getItem('current_email') || '';
    } catch {
      return '';
    }
  });

  const [authEmail, setAuthEmail] = useState<string>(() => {
    try {
      return localStorage.getItem('last_auth_email') || '';
    } catch {
      return '';
    }
  });
  const [authPassword, setAuthPassword] = useState<string>(() => {
    try {
      return localStorage.getItem('last_auth_password') || '';
    } catch {
      return '';
    }
  });
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    try {
      const savedEmail = localStorage.getItem('current_email');
      const savedUsers = localStorage.getItem('registered_users');
      const users = savedUsers ? JSON.parse(savedUsers) : [];
      const user = users.find((u: UserAccount) => u.email === savedEmail);
      return user ? (user.isOnline ?? false) : false;
    } catch {
      return false;
    }
  });
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [feeUpdated, setFeeUpdated] = useState<boolean>(false);
  const [acceptTerms, setAcceptTerms] = useState<boolean>(false);
  const [popupMessage, setPopupMessage] = useState<{ type: 'congrats' | 'welcome'; text: string } | null>(null);
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState<boolean>(false);

  // Gig State
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [showCreateGigModal, setShowCreateGigModal] = useState<boolean>(false);
  const [isCreatingGig, setIsCreatingGig] = useState<boolean>(false);
  const [newGigTitle, setNewGigTitle] = useState<string>('');
  const [newGigDetails, setNewGigDetails] = useState<string>('');
  const [newGigDate, setNewGigDate] = useState<string>('');
  const [newGigIsImmediate, setNewGigIsImmediate] = useState<boolean>(false);
  const [newGigBudget, setNewGigBudget] = useState<string>('');
  const [newGigLocation, setNewGigLocation] = useState<string>('');
  const [newGigExperience, setNewGigExperience] = useState<string>('');
  const [newGigLat, setNewGigLat] = useState<number | null>(null);
  const [newGigLng, setNewGigLng] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const [position, setPosition] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [locationName, setLocationName] = useState<string>('');
  const [status, setStatus] = useState<'locating' | 'located' | 'error' | 'denied'>('locating');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [watchId, setWatchId] = useState<number | null>(null);
  const [isFollowing, setIsFollowing] = useState<boolean>(true);
  const [isSatellite, setIsSatellite] = useState<boolean>(false);

  // Activation & KYC Modal State
  const [showActivationModal, setShowActivationModal] = useState<boolean>(false);
  const [activationStep, setActivationStep] = useState<'plan' | 'kyc' | 'loading' | 'success'>('plan');
  const [selectedPlan, setSelectedPlan] = useState<'user' | 'tenant'>('user');

  const [subscriptionState, setSubscriptionState] = useState<'none' | 'user' | 'tenant'>(() => {
    try {
      const savedEmail = localStorage.getItem('current_email');
      const savedUsers = localStorage.getItem('registered_users');
      const users = savedUsers ? JSON.parse(savedUsers) : [];
      const user = users.find((u: UserAccount) => u.email === savedEmail);
      return user ? user.subscriptionState : 'none';
    } catch {
      return 'none';
    }
  });

  // KYC Uploads & Remembered Documents State
  const [selfieImage, setSelfieImage] = useState<string | null>(() => {
    try {
      const savedEmail = localStorage.getItem('current_email');
      if (!savedEmail) return null;
      const directSaved = localStorage.getItem(`selfie_image_${savedEmail}`);
      if (directSaved) return directSaved;
      const savedUsers = localStorage.getItem('registered_users');
      const users = savedUsers ? JSON.parse(savedUsers) : [];
      const user = users.find((u: UserAccount) => u.email === savedEmail);
      if (user?.selfieImage) return user.selfieImage;
      const savedRefs = localStorage.getItem('referral_list');
      const refs = savedRefs ? JSON.parse(savedRefs) : [];
      const ref = refs.find((r: Referral) => r.email === savedEmail);
      return ref?.selfieUrl || null;
    } catch {
      return null;
    }
  });

  const [idDocUrl, setIdDocUrl] = useState<string | null>(() => {
    try {
      const savedEmail = localStorage.getItem('current_email');
      if (!savedEmail) return null;
      const directSaved = localStorage.getItem(`id_doc_url_${savedEmail}`);
      if (directSaved) return directSaved;
      const savedUsers = localStorage.getItem('registered_users');
      const users = savedUsers ? JSON.parse(savedUsers) : [];
      const user = users.find((u: UserAccount) => u.email === savedEmail);
      if (user?.idDocUrl) return user.idDocUrl;
      const savedRefs = localStorage.getItem('referral_list');
      const refs = savedRefs ? JSON.parse(savedRefs) : [];
      const ref = refs.find((r: Referral) => r.email === savedEmail);
      return ref?.idDocUrl || null;
    } catch {
      return null;
    }
  });

  const [idDocName, setIdDocName] = useState<string>(() => {
    try {
      const savedEmail = localStorage.getItem('current_email');
      if (!savedEmail) return '';
      const directSaved = localStorage.getItem(`id_doc_name_${savedEmail}`);
      if (directSaved) return directSaved;
      const savedUsers = localStorage.getItem('registered_users');
      const users = savedUsers ? JSON.parse(savedUsers) : [];
      const user = users.find((u: UserAccount) => u.email === savedEmail);
      if (user?.idDocName) return user.idDocName;
      const savedRefs = localStorage.getItem('referral_list');
      const refs = savedRefs ? JSON.parse(savedRefs) : [];
      const ref = refs.find((r: Referral) => r.email === savedEmail);
      return ref?.idDocName || '';
    } catch {
      return '';
    }
  });

  const [popDocUrl, setPopDocUrl] = useState<string | null>(() => {
    try {
      const savedEmail = localStorage.getItem('current_email');
      if (!savedEmail) return null;
      const directSaved = localStorage.getItem(`pop_doc_url_${savedEmail}`);
      if (directSaved) return directSaved;
      const savedUsers = localStorage.getItem('registered_users');
      const users = savedUsers ? JSON.parse(savedUsers) : [];
      const user = users.find((u: UserAccount) => u.email === savedEmail);
      if (user?.popDocUrl) return user.popDocUrl;
      const savedRefs = localStorage.getItem('referral_list');
      const refs = savedRefs ? JSON.parse(savedRefs) : [];
      const ref = refs.find((r: Referral) => r.email === savedEmail);
      return ref?.popDocUrl || null;
    } catch {
      return null;
    }
  });

  const [popDocName, setPopDocName] = useState<string>(() => {
    try {
      const savedEmail = localStorage.getItem('current_email');
      if (!savedEmail) return '';
      const directSaved = localStorage.getItem(`pop_doc_name_${savedEmail}`);
      if (directSaved) return directSaved;
      
      const savedUsers = localStorage.getItem('registered_users');
      const users = savedUsers ? JSON.parse(savedUsers) : [];
      const user = users.find((u: UserAccount) => u.email === savedEmail);
      if (user?.popDocName) return user.popDocName;
      
      const savedRefs = localStorage.getItem('referral_list');
      const refs = savedRefs ? JSON.parse(savedRefs) : [];
      const ref = refs.find((r: Referral) => r.email === savedEmail);
      return ref?.popDocName || '';
    } catch {
      return '';
    }
  });

  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [idDocFile, setIdDocFile] = useState<File | null>(null);
  const [popFile, setPopFile] = useState<File | null>(null);

  // Bottom Navigation Views ('map' | 'tenant-portal' | 'seekers' | 'gigs' | 'profile')
  const [activeView, setActiveView] = useState<'map' | 'tenant-portal' | 'seekers' | 'gigs' | 'profile'>('map');

  // Tenant portal financial & referral state
  const [userSubProfit, setUserSubProfit] = useState<number>(0.0);
  const [tenantSubProfit, setTenantSubProfit] = useState<number>(0.0);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Referrals List for Tenant review
  const [referrals, setReferrals] = useState<Referral[]>(() => {
    try {
      const saved = localStorage.getItem('referral_list');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error parsing referral_list:', e);
    }
    return [];
  });

  const [referralCode, setReferralCode] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('ref');
  });

  const [showReferralsModal, setShowReferralsModal] = useState<boolean>(false);

  // Derive a stable referral code from email to track referrers reliably
  const getReferralCode = (email: string) => {
    return `tenant_${btoa(email).substring(0, 12).replace(/=/g, '')}`;
  };

  const tenantReferralLink = `${window.location.origin}/?ref=${getReferralCode(currentEmail)}`;

  // Determine if current user or referral is already registered / activated
  const isAlreadyRegistered = Boolean(
    (subscriptionState && subscriptionState !== 'none') ||
    (currentEmail && referrals.some(r => r.email === currentEmail)) ||
    (currentEmail && registeredUsers.some(u => u.email === currentEmail && u.subscriptionState && u.subscriptionState !== 'none'))
  );

  const handleOpenActivationModal = () => {
    if (isAlreadyRegistered) {
      setPopupMessage({
        type: 'welcome',
        text: 'Your account is already registered with an active subscription. Registered referrals and users cannot activate another subscription.'
      });
      return;
    }
    setShowActivationModal(true);
    setActivationStep('plan');
  };

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchSuggestions, setSearchSuggestions] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [showExperienceModal, setShowExperienceModal] = useState<boolean>(false);
  const [showReferenceModal, setShowReferenceModal] = useState<boolean>(false);
  const [newExperienceItem, setNewExperienceItem] = useState<string>('');
  const [newReferenceItem, setNewReferenceItem] = useState<string>('');
  const [editFirstName, setEditFirstName] = useState<string>('');
  const [editLastName, setEditLastName] = useState<string>('');
  const [editDob, setEditDob] = useState<string>('');
  const [editContact, setEditContact] = useState<string>('');
  const [editLocation, setEditLocation] = useState<string>('');
  const [editEducationLevel, setEditEducationLevel] = useState<string>('');
  const [editWorkingTrades, setEditWorkingTrades] = useState<string[]>([]);
  const [editGigCategories, setEditGigCategories] = useState<string[]>([]);
  const [editExperience, setEditExperience] = useState<string[]>([]);
  const [editReferences, setEditReferences] = useState<string[]>([]);

  // Document viewer state
  const [viewingDoc, setViewingDoc] = useState<{ url: string; title: string } | null>(null);
  const [viewingSeekerProfile, setViewingSeekerProfile] = useState<any | null>(null);

  // Help Modal State
  const [activeHelp, setActiveHelp] = useState<{ title: string; sections: Array<{ title: string; content: string }> } | null>(null);

  const helpContent = {
    auth: {
      title: "Welcome to TimeGiG",
      sections: [
        { title: "What is TimeGiG?", content: "TimeGiG is a map-centric platform designed to connect gig seekers with local opportunities. Whether you're looking for work or looking to hire, TimeGiG provides a verified, real-time map of active users in South Africa." },
        { title: "Getting Started", content: "Create an account or log in to access the interactive map. Once authenticated, you can explore the area, search for specific locations, and activate your subscription to unlock professional features." }
      ]
    },
    map: {
      title: "How to use the Map",
      sections: [
        { title: "Navigation", content: "Use the search bar at the top to find specific streets, towns, or provinces. The map supports both standard street view and satellite imagery (toggle via the layers icon)." },
        { title: "Your Location", content: "The blue pulsing dot indicates your real-time GPS position. Use the 'Recenter' button (target icon) to snap the map back to your current location." },
        { title: "Seekers & Gigs", content: "Active service providers and gig opportunities appear as markers on the map. Click them to view details or navigate to their location." }
      ]
    },
    tenant: {
      title: "Tenant Portal Guide",
      sections: [
        { title: "Passive Income", content: "As a Tenant, you earn the monthly subscription fees set in your portal for every User and Tenant joined through your unique referral link." },
        { title: "Dynamic Fees", content: "You have the power to set your own subscription rates! Use the 'Network Settings' panel to adjust what your referrals pay for User and Tenant subs." },
        { title: "Referral Management", content: "The 'Total Referrals' section shows everyone who signed up using your link. You are responsible for reviewing their KYC documents and approving their access." }
      ]
    },
    seekers: {
      title: "Seekers Directory",
      sections: [
        { title: "Verified Professionals", content: "This list shows active users and tenants in your area. Use this directory to find trusted service providers for your specific needs." },
        { title: "Ratings & Trust", content: "Every seeker has a star rating based on their previous performance. Look for 'Verified' badges to ensure you're connecting with legitimate users." }
      ]
    },
    profile: {
      title: "Account & Profile",
      sections: [
        { title: "Managing Subscription", content: "Your profile displays your current plan and verification status. You can upgrade or change your subscription at any time using the 'Upgrade' button." },
        { title: "Account Control", content: "If you need to take a break, you can 'Disable' your account." }
      ]
    },
    activation: {
      title: "Activation & KYC",
      sections: [
        { title: "Why KYC?", content: "Know Your Customer (KYC) is required to ensure a safe community. We verify your identity via a selfie and ID document to prevent fraud and protect all users." },
        { title: "Payment Verification", content: "After choosing a plan, you must upload your Proof of Payment. A tenant will review your documents and approve your account within 24-48 hours." }
      ]
    }
  };

  // Referral Limits (Settable by Master Tenant)
  const [tenantLimitConfig, setTenantLimitConfig] = useState<number>(() => {
    return Number(localStorage.getItem('tenant_limit_config')) || 10;
  });
  const [userLimitConfig, setUserLimitConfig] = useState<number>(() => {
    return Number(localStorage.getItem('user_limit_config')) || 100;
  });

  // Dynamic Subscription Fees (Settable by each Tenant for their referrals)
  // Default values: User R29.99, Tenant R299.99
  const [userSubFee, setUserSubFee] = useState<number>(() => {
    const saved = localStorage.getItem(`user_fee_${currentEmail}`);
    return saved ? Number(saved) : 29.99;
  });
  const [tenantSubFee, setTenantSubFee] = useState<number>(() => {
    const saved = localStorage.getItem(`tenant_fee_${currentEmail}`);
    return saved ? Number(saved) : 299.99;
  });
  const [trialDays, setTrialDays] = useState<number>(() => {
    const saved = localStorage.getItem(`trial_days_${currentEmail}`);
    return saved ? Number(saved) : 30;
  });

  // Bank Details (Settable by each Tenant for their payouts)
  const [bankName, setBankName] = useState<string>(() => {
    return localStorage.getItem(`bank_name_${currentEmail}`) || '';
  });
  const [accountHolder, setAccountHolder] = useState<string>(() => {
    return localStorage.getItem(`acc_holder_${currentEmail}`) || '';
  });
  const [accountNumber, setAccountNumber] = useState<string>(() => {
    return localStorage.getItem(`acc_num_${currentEmail}`) || '';
  });
  const [branchCode, setBranchCode] = useState<string>(() => {
    return localStorage.getItem(`branch_code_${currentEmail}`) || '';
  });

  useEffect(() => {
    localStorage.setItem('tenant_limit_config', tenantLimitConfig.toString());
  }, [tenantLimitConfig]);

  useEffect(() => {
    localStorage.setItem('user_limit_config', userLimitConfig.toString());
  }, [userLimitConfig]);

  useEffect(() => {
    if (currentEmail) {
      localStorage.setItem(`trial_days_${currentEmail}`, trialDays.toString());
    }
  }, [trialDays, currentEmail]);
  useEffect(() => {
    if (currentEmail) {
      localStorage.setItem(`user_fee_${currentEmail}`, userSubFee.toString());
    }
  }, [userSubFee, currentEmail]);

  useEffect(() => {
    if (currentEmail) {
      localStorage.setItem(`tenant_fee_${currentEmail}`, tenantSubFee.toString());
    }
  }, [tenantSubFee, currentEmail]);

  useEffect(() => {
    if (currentEmail) {
      localStorage.setItem(`bank_name_${currentEmail}`, bankName);
    }
  }, [bankName, currentEmail]);

  useEffect(() => {
    if (currentEmail) {
      localStorage.setItem(`acc_holder_${currentEmail}`, accountHolder);
    }
  }, [accountHolder, currentEmail]);

  useEffect(() => {
    if (currentEmail) {
      localStorage.setItem(`acc_num_${currentEmail}`, accountNumber);
    }
  }, [accountNumber, currentEmail]);

  useEffect(() => {
    if (currentEmail) {
      localStorage.setItem(`branch_code_${currentEmail}`, branchCode);
    }
  }, [branchCode, currentEmail]);

  // Guided Onboarding for new users
  useEffect(() => {
    if (isFirstTimeUser && authMode === 'authenticated' && !showSplash) {
      if (!isAlreadyRegistered) {
        setShowActivationModal(true);
        setActivationStep('plan');
        // Guidance message
        setPopupMessage({ 
          type: 'congrats', 
          text: 'Welcome! Let\'s get your account activated. Please follow the steps to complete your KYC and choose a subscription plan.' 
        });
      }
      setIsFirstTimeUser(false); // Reset so it doesn't re-trigger
    }
  }, [isFirstTimeUser, authMode, showSplash, isAlreadyRegistered]);

  // Custom pulsing location icon using Leaflet divIcon
  const userIcon = L.divIcon({
    className: 'custom-user-location-marker',
    html: `
      <div style="
        position: relative;
        width: 24px;
        height: 24px;
        background: #2563eb;
        border: 3px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 0 10px rgba(0,0,0,0.3);
      ">
        <div style="
          position: absolute;
          top: -6px;
          left: -6px;
          right: -6px;
          bottom: -6px;
          border: 2px solid #2563eb;
          border-radius: 50%;
          animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        "></div>
      </div>
      <style>
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(0.95); opacity: 0; }
        }
      </style>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  // Helper functions to save to Firestore with error handling
  const sanitizeForFirestore = (data: any) => {
    const sanitized = { ...data };
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key] === undefined) {
        sanitized[key] = null;
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        if (Array.isArray(sanitized[key])) {
          sanitized[key] = sanitized[key].map((item: any) => 
            typeof item === 'object' && item !== null ? sanitizeForFirestore(item) : item
          );
        } else {
          sanitized[key] = sanitizeForFirestore(sanitized[key]);
        }
      }
    });
    return sanitized;
  };

  const saveUserToFirestore = async (userAcc: UserAccount) => {
    if (!userAcc.email || !auth.currentUser) return;
    const docId = userAcc.email.replace(/[^a-zA-Z0-9_]/g, '_');
    try {
      const sanitizedUser = sanitizeForFirestore(userAcc);
      await setDoc(doc(db, 'users', docId), sanitizedUser, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${docId}`);
    }
  };

  const saveReferralToFirestore = async (refItem: Referral) => {
    if (!refItem.id || !auth.currentUser) return;
    const docId = refItem.id;
    try {
      const sanitizedRef = sanitizeForFirestore(refItem);
      await setDoc(doc(db, 'referrals', docId), sanitizedRef, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `referrals/${docId}`);
    }
  };

  const saveGigToFirestore = async (gigItem: Gig) => {
    if (!gigItem.id || !auth.currentUser) return;
    try {
      const sanitizedGig = sanitizeForFirestore(gigItem);
      await setDoc(doc(db, 'gigs', gigItem.id), sanitizedGig, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `gigs/${gigItem.id}`);
    }
  };

  // Listener for custom events from map popups (e.g. "View Profile" from marker)
  useEffect(() => {
    const handleViewSeeker = (e: any) => {
      const email = e.detail;
      const seeker = registeredUsers.find(u => u.email === email);
      if (seeker) {
        setViewingSeekerProfile({
          name: `${seeker.firstName} ${seeker.lastName}`,
          role: seeker.workingTrade || 'Seeker',
          location: seeker.location || 'Location active',
          rating: '5.0',
          email: seeker.email
        });
      }
    };
    window.addEventListener('viewSeeker', handleViewSeeker as EventListener);
    return () => window.removeEventListener('viewSeeker', handleViewSeeker as EventListener);
  }, [registeredUsers]);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user && user.email) {
        setCurrentEmail(user.email);
        setAuthMode('authenticated');
      }
    });
    return () => unsubscribe();
  }, []);

  // Firebase Firestore Users Realtime Listener (only active when authenticated)
  useEffect(() => {
    if (!currentUser) return;
    const usersCol = collection(db, 'users');
    const unsubscribe = onSnapshot(
      usersCol,
      (snapshot) => {
        const usersList: UserAccount[] = [];
        snapshot.forEach((docSnap) => {
          usersList.push(docSnap.data() as UserAccount);
        });
        if (usersList.length > 0) {
          setRegisteredUsers(usersList);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'users');
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  // Firebase Firestore Referrals Realtime Listener (only active when authenticated)
  useEffect(() => {
    if (!currentUser) return;
    const referralsCol = collection(db, 'referrals');
    const unsubscribe = onSnapshot(
      referralsCol,
      (snapshot) => {
        const refList: Referral[] = [];
        snapshot.forEach((docSnap) => {
          refList.push(docSnap.data() as Referral);
        });
        if (refList.length > 0) {
          setReferrals(refList);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'referrals');
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  // Firebase Firestore Gigs Realtime Listener (only active when authenticated)
  useEffect(() => {
    if (!currentUser) return;
    const gigsCol = collection(db, 'gigs');
    const unsubscribe = onSnapshot(
      gigsCol,
      (snapshot) => {
        const gigList: Gig[] = [];
        snapshot.forEach((docSnap) => {
          gigList.push(docSnap.data() as Gig);
        });
        setGigs(gigList);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'gigs');
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  // Save registered users & current session to localStorage & sync
  useEffect(() => {
    localStorage.setItem('registered_users', JSON.stringify(registeredUsers));
  }, [registeredUsers]);

  useEffect(() => {
    localStorage.setItem('referral_list', JSON.stringify(referrals));
  }, [referrals]);

  useEffect(() => {
    if (currentEmail) {
      localStorage.setItem('current_email', currentEmail);
      localStorage.setItem('saved_auth', 'true');
    } else {
      localStorage.removeItem('current_email');
      localStorage.removeItem('saved_auth');
    }
  }, [currentEmail]);

  // Update user profile in registeredUsers and persist documents whenever documents or subscriptionState change
  useEffect(() => {
    if (!currentEmail) return;

    if (selfieImage) {
      localStorage.setItem(`selfie_image_${currentEmail}`, selfieImage);
    }
    if (idDocUrl) {
      localStorage.setItem(`id_doc_url_${currentEmail}`, idDocUrl);
    }
    if (idDocName) {
      localStorage.setItem(`id_doc_name_${currentEmail}`, idDocName);
    }
    if (popDocUrl) {
      localStorage.setItem(`pop_doc_url_${currentEmail}`, popDocUrl);
    }
    if (popDocName) {
      localStorage.setItem(`pop_doc_name_${currentEmail}`, popDocName);
    }

    setRegisteredUsers((prev) =>
      prev.map((u) => {
        if (u.email === currentEmail) {
          const updated: UserAccount = {
            ...u,
            subscriptionState,
            selfieImage: selfieImage || u.selfieImage,
            idDocName: idDocName || u.idDocName,
            idDocUrl: idDocUrl || u.idDocUrl,
            popDocName: popDocName || u.popDocName,
            popDocUrl: popDocUrl || u.popDocUrl,
          };
          saveUserToFirestore(updated);
          return updated;
        }
        return u;
      })
    );
  }, [subscriptionState, selfieImage, idDocUrl, idDocName, popDocUrl, popDocName, currentEmail]);

  // Restore remembered selfie, idDoc, and popDoc when currentEmail or records update
  useEffect(() => {
    if (!currentEmail) return;
    const user = registeredUsers.find((u) => u.email === currentEmail);
    const ref = referrals.find((r) => r.email === currentEmail);

    const savedSelfie = localStorage.getItem(`selfie_image_${currentEmail}`) || user?.selfieImage || ref?.selfieUrl || null;
    if (savedSelfie && !selfieImage) setSelfieImage(savedSelfie);

    const savedIdUrl = localStorage.getItem(`id_doc_url_${currentEmail}`) || user?.idDocUrl || ref?.idDocUrl || null;
    if (savedIdUrl && !idDocUrl) setIdDocUrl(savedIdUrl);

    const savedIdName = localStorage.getItem(`id_doc_name_${currentEmail}`) || user?.idDocName || ref?.idDocName || '';
    if (savedIdName && !idDocName) setIdDocName(savedIdName);

    const savedPopUrl = localStorage.getItem(`pop_doc_url_${currentEmail}`) || user?.popDocUrl || ref?.popDocUrl || null;
    if (savedPopUrl && !popDocUrl) setPopDocUrl(savedPopUrl);

    const savedPopName = localStorage.getItem(`pop_doc_name_${currentEmail}`) || user?.popDocName || ref?.popDocName || '';
    if (savedPopName && !popDocName) setPopDocName(savedPopName);
  }, [currentEmail, registeredUsers, referrals]);

  // Auto-sync subscriptionState if current user is already registered in referrals or registeredUsers
  useEffect(() => {
    if (!currentEmail) return;
    const ref = referrals.find((r) => r.email === currentEmail);
    if (ref && ref.activatedPlan && subscriptionState === 'none') {
      setSubscriptionState(ref.activatedPlan);
      return;
    }
    const user = registeredUsers.find((u) => u.email === currentEmail);
    if (user && user.subscriptionState && user.subscriptionState !== 'none' && subscriptionState === 'none') {
      setSubscriptionState(user.subscriptionState);
    }
  }, [currentEmail, referrals, registeredUsers, subscriptionState]);

  // Sync profile edit states with current user data
  useEffect(() => {
    if (!currentEmail || isEditingProfile) return;
    const user = registeredUsers.find(u => u.email === currentEmail);
    if (user) {
      setEditFirstName(user.firstName || '');
      setEditLastName(user.lastName || '');
      setEditDob(user.dob || '');
      setEditContact(user.contact || '');
      setEditLocation(user.location || '');
      setEditEducationLevel(user.educationLevel || '');
      setEditWorkingTrades(user.workingTrades || (user.workingTrade ? [user.workingTrade] : []));
      setEditGigCategories(user.gigCategories || []);
      setEditExperience(user.experience || []);
      setEditReferences(user.references || []);
    }
  }, [currentEmail, registeredUsers, isEditingProfile]);

  // Effect for activeView to invalidate map size instantly and prevent white screen
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 50);
    }
  }, [activeView]);

  // Calculate profits based on approved referrals
  useEffect(() => {
    const relevantReferrals = currentEmail === 'timegig2026@gmail.com' 
      ? referrals 
      : referrals.filter(r => r.referrerEmail === currentEmail);
    
    const approved = relevantReferrals.filter(r => r.status === 'Approved');
    
    // Profits match the fees set by the tenant
    const userProfit = approved.filter(r => r.activatedPlan === 'user').length * userSubFee;
    const tenantProfit = approved.filter(r => r.activatedPlan === 'tenant').length * tenantSubFee;
    
    setUserSubProfit(userProfit);
    setTenantSubProfit(tenantProfit);
  }, [referrals, registeredUsers, currentEmail, userSubFee, tenantSubFee]);

  // Effect to initialize map
  useEffect(() => {
    let map: L.Map | null = null;
    let watchId: number | null = null;

    if (authMode !== 'authenticated') {
      if (!authMapContainerRef.current) return;
      
      map = L.map(authMapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,
      }).setView([20, 0], 2);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '',
        subdomains: ['a', 'b', 'c'],
        keepBuffer: 4,
      }).addTo(map);

      setTimeout(() => {
        map?.invalidateSize();
      }, 250);

    } else {
      if (!mapContainerRef.current) return;

      let initialCenter: [number, number] = [20, 0];
      let initialZoom = 2;
      
      try {
        const savedCenter = localStorage.getItem('map_center');
        const savedZoom = localStorage.getItem('map_zoom');
        if (savedCenter) initialCenter = JSON.parse(savedCenter);
        if (savedZoom) initialZoom = parseInt(savedZoom, 10);
      } catch (e) {
        console.error('Error parsing map state:', e);
      }

      try {
        map = L.map(mapContainerRef.current, {
          zoomControl: false,
          preferCanvas: true,
        }).setView(initialCenter, initialZoom);
      } catch (e) {
        console.error('Leaflet initialization error:', e);
        return;
      }

      const initialTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '',
        subdomains: ['a', 'b', 'c'],
        keepBuffer: 4,
        updateWhenIdle: false,
        updateWhenZooming: false,
      }).addTo(map);

      tileLayerRef.current = initialTileLayer;
      mapRef.current = map;

      map.on('dragstart', () => {
        setIsFollowing(false);
      });

      map.on('moveend', () => {
        if (!map) return;
        const center = map.getCenter();
        localStorage.setItem('map_center', JSON.stringify([center.lat, center.lng]));
      });

      map.on('zoomend', () => {
        if (!map) return;
        localStorage.setItem('map_zoom', map.getZoom().toString());
      });

      const savedCenter = localStorage.getItem('map_center');
      if (!savedCenter) {
        startGeolocation(map);
      } else {
        setStatus('located');
      }

      setTimeout(() => {
        map?.invalidateSize();
      }, 250);
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (map) {
        map.remove();
      }
      mapRef.current = null;
    };
  }, [authMode]);

  // Effect to manage markers for seekers and gigs
  useEffect(() => {
    if (!mapRef.current || authMode !== 'authenticated') return;

    const seekerMarkers: L.Marker[] = [];
    const gigMarkers: L.Marker[] = [];

    // Add Online Seeker Markers
    registeredUsers.forEach(user => {
      if (user.isOnline && user.lat && user.lng && user.email !== currentEmail) {
        const marker = L.marker([user.lat, user.lng], {
          icon: L.divIcon({
            className: 'seeker-marker',
            html: `
              <div style="background: #10b981; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>
            `,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
          })
        }).addTo(mapRef.current!);
        
        marker.bindPopup(`
          <div style="font-family: sans-serif; padding: 4px;">
            <b style="font-size: 14px;">${user.firstName} ${user.lastName}</b>
            <p style="margin: 4px 0; font-size: 12px; color: #666;">Seeker • ${user.workingTrade || 'General'}</p>
            <button onclick="window.dispatchEvent(new CustomEvent('viewSeeker', {detail: '${user.email}'}))" style="background: #2563eb; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer; width: 100%;">View Profile</button>
          </div>
        `);
        seekerMarkers.push(marker);
      }
    });

    // Add Active Gig Markers
    gigs.forEach(gig => {
      if (gig.status === 'Active') {
        const marker = L.marker([gig.lat, gig.lng], {
          icon: L.divIcon({
            className: 'gig-marker',
            html: `
              <div style="background: #2563eb; width: 16px; height: 16px; border-radius: 4px; display: flex; items-center; justify-content: center; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3);">
                <span style="color: white; font-size: 10px; font-weight: bold;">G</span>
              </div>
            `,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          })
        }).addTo(mapRef.current!);
        
        marker.bindPopup(`
          <div style="font-family: sans-serif; min-width: 150px; padding: 4px;">
            <b style="font-size: 14px; display: block; margin-bottom: 4px;">${gig.title}</b>
            <div style="font-size: 12px; color: #444; margin-bottom: 8px;">
              <p style="margin: 2px 0;">💰 Budget: <b>${gig.budget}</b></p>
              <p style="margin: 2px 0;">🕒 ${gig.isImmediate ? '<b>Immediate!</b>' : gig.date}</p>
            </div>
            <p style="font-size: 11px; color: #666; margin-bottom: 10px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${gig.details}</p>
            <button style="background: #2563eb; color: white; border: none; padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: bold; cursor: pointer; width: 100%;">Apply Now</button>
          </div>
        `);
        gigMarkers.push(marker);
      }
    });

    return () => {
      seekerMarkers.forEach(m => m.remove());
      gigMarkers.forEach(m => m.remove());
    };
  }, [registeredUsers, gigs, authMode]);

  const fetchLocationName = async (lat: number, lng: number) => {
    try {
      const name = await reverseGeocode(lat, lng);
      if (name) {
        setLocationName(name);
      }
    } catch {
      setLocationName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }
  };

  const updateMapLocation = (lat: number, lng: number, accuracy: number, map: L.Map) => {
    setPosition({ lat, lng, accuracy });
    setStatus('located');
    fetchLocationName(lat, lng);

    const newLatLng = new L.LatLng(lat, lng);

    if (markerRef.current) {
      markerRef.current.setLatLng(newLatLng);
    } else {
      const marker = L.marker(newLatLng, { icon: userIcon }).addTo(map);
      marker.bindPopup(`<b>Your Location</b><br>Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}<br>Accuracy: ±${Math.round(accuracy)}m`);
      markerRef.current = marker;
    }

    if (circleRef.current) {
      circleRef.current.setLatLng(newLatLng);
      circleRef.current.setRadius(accuracy);
    } else {
      const circle = L.circle(newLatLng, {
        radius: accuracy,
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
        weight: 1,
      }).addTo(map);
      circleRef.current = circle;
    }

    if (isFollowing) {
      map.setView(newLatLng, Math.max(map.getZoom(), 15));
    }
  };

  const startGeolocation = (mapInstance: L.Map) => {
    if (!navigator.geolocation) {
      setStatus('error');
      setErrorMessage('Geolocation is not supported by your browser');
      return;
    }

    setStatus('locating');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        updateMapLocation(latitude, longitude, accuracy, mapInstance);
      },
      (error) => {
        console.warn('Geolocation error:', error);
        if (error.code === error.PERMISSION_DENIED) {
          setStatus('denied');
          setErrorMessage('Location permission denied.');
        } else {
          setStatus('error');
          setErrorMessage(error.message || 'Unable to retrieve your location');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (mapRef.current) {
          updateMapLocation(latitude, longitude, accuracy, mapRef.current);
        }
      },
      (error) => {
        console.warn('Watch position error:', error);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );

    setWatchId(id);
  };

  const handleRecenter = () => {
    setIsFollowing(true);
    if (position && mapRef.current) {
      mapRef.current.setView([position.lat, position.lng], 16, { animate: true });
    } else if (mapRef.current) {
      startGeolocation(mapRef.current);
    }
  };

  const handleZoomIn = () => {
    if (mapRef.current) {
      mapRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current) {
      mapRef.current.zoomOut();
    }
  };

  const toggleSatellite = () => {
    if (!mapRef.current) return;
    const nextSatellite = !isSatellite;
    setIsSatellite(nextSatellite);

    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }

    const newLayerUrl = nextSatellite
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const newLayer = L.tileLayer(newLayerUrl, {
      maxZoom: 19,
      attribution: '',
      subdomains: ['a', 'b', 'c'],
      keepBuffer: 4,
    }).addTo(mapRef.current);

    tileLayerRef.current = newLayer;
  };

  // Search suggestions
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await searchLocations(searchQuery, 5, position);
        if (results && results.length > 0) {
          setSearchSuggestions(results);
          setShowSuggestions(true);
        }
      } catch {
        // Graceful non-blocking
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, position]);

  const handleSelectLocation = (latStr: string, lonStr: string, displayName: string) => {
    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);

    // Automatically take user to location on the map view
    setActiveView('map');

    if (mapRef.current) {
      mapRef.current.setView([lat, lon], 15, { animate: true });

      if (searchMarkerRef.current) {
        searchMarkerRef.current.setLatLng([lat, lon]);
        searchMarkerRef.current.setPopupContent(`<b>${displayName}</b>`).openPopup();
      } else {
        const marker = L.marker([lat, lon]).addTo(mapRef.current);
        marker.bindPopup(`<b>${displayName}</b>`).openPopup();
        searchMarkerRef.current = marker;
      }
    }

    setSearchQuery(displayName);
    setShowSuggestions(false);
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !mapRef.current) return;

    setShowSuggestions(false);

    const lower = searchQuery.trim().toLowerCase();
    const isNearby = lower.includes('near') || lower.includes('around') || lower.includes('close');

    if (isNearby) {
      const lat = position?.lat || -26.2041;
      const lng = position?.lng || 28.0473;
      handleSelectLocation(
        lat.toString(),
        lng.toString(),
        locationName ? `Nearby Places: ${locationName}` : 'Nearby Places (Your Current Location)'
      );
      return;
    }

    try {
      const results = await searchLocations(searchQuery, 1, position);
      if (results && results.length > 0) {
        const { lat, lon, display_name } = results[0];
        handleSelectLocation(lat, lon, display_name);
      } else {
        setErrorMessage('Location not found.');
        setTimeout(() => setErrorMessage(''), 3000);
      }
    } catch {
      setErrorMessage('Search temporarily unavailable.');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  // Camera handling with explicit permission request
  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera access permission error:', err);
      alert('Camera permission denied or unavailable. Please check your browser camera settings or upload a selfie image file instead.');
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setSelfieImage(dataUrl);
        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isAlreadyRegistered) {
      setPopupMessage({
        type: 'welcome',
        text: 'You are already registered! Registered referrals and users cannot activate a subscription again.'
      });
      setShowActivationModal(false);
      return;
    }

    if (!selfieImage) {
      alert('Please provide your face selfie picture.');
      return;
    }
    if (!idDocFile && !idDocUrl) {
      alert('ID Document is required. Please upload or attach your ID document.');
      return;
    }
    const activeReferrer = registeredUsers.find(u => getReferralCode(u.email) === referralCode);
    const activeReferrerEmail = activeReferrer ? activeReferrer.email : 'direct';
    const isReferral = activeReferrerEmail !== 'direct';
    const isTrial = isReferral && trialDays > 0;
    
    if (!popFile && !popDocUrl && !isTrial) {
      alert('Proof of Payment is required. Please upload your proof of payment document.');
      return;
    }

    setActivationStep('loading');

    try {
      const fileToDataURL = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      };

      const [newIdDocUrl, rawPopDocUrl] = await Promise.all([
        idDocFile ? fileToDataURL(idDocFile) : Promise.resolve(idDocUrl || ''),
        popFile ? fileToDataURL(popFile) : Promise.resolve(popDocUrl || null)
      ]);
      const finalIdDocUrl = newIdDocUrl || idDocUrl || '';
      const finalIdDocName = idDocFile?.name || idDocName || 'id_document.pdf';
      const finalPopDocUrl = rawPopDocUrl || popDocUrl || undefined;
      const finalPopDocName = popFile?.name || popDocName || 'payment_proof.pdf';

      if (finalIdDocUrl) {
        setIdDocUrl(finalIdDocUrl);
        setIdDocName(finalIdDocName);
        if (currentEmail) {
          localStorage.setItem(`id_doc_url_${currentEmail}`, finalIdDocUrl);
          localStorage.setItem(`id_doc_name_${currentEmail}`, finalIdDocName);
        }
      }
      if (finalPopDocUrl) {
        setPopDocUrl(finalPopDocUrl);
        setPopDocName(finalPopDocName);
        if (currentEmail) {
          localStorage.setItem(`pop_doc_url_${currentEmail}`, finalPopDocUrl);
          localStorage.setItem(`pop_doc_name_${currentEmail}`, finalPopDocName);
        }
      }

      setTimeout(() => {
        const referrerEmail = activeReferrerEmail;

        // Check limits
        const isMasterTenant = referrerEmail === 'timegig2026@gmail.com';
        // Master tenant has 1000/1000 limit, others use the configured limits set by master
        const tenantLimit = isMasterTenant ? 1000 : tenantLimitConfig;
        const userLimit = isMasterTenant ? 1000 : userLimitConfig;

        const currentReferrals = referrals.filter(r => r.referrerEmail === referrerEmail);
        const currentTenantCount = currentReferrals.filter(r => r.activatedPlan === 'tenant').length;
        const currentUserCount = currentReferrals.filter(r => r.activatedPlan === 'user').length;

        if (selectedPlan === 'tenant' && currentTenantCount >= tenantLimit) {
          alert(`Referral limit reached for Tenant subscriptions (${tenantLimit}).`);
          setActivationStep('plan');
          return;
        }
        if (selectedPlan === 'user' && currentUserCount >= userLimit) {
          alert(`Referral limit reached for User subscriptions (${userLimit}).`);
          setActivationStep('plan');
          return;
        }

        setSubscriptionState(selectedPlan);
        
        // Play congratulations sound
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
        audio.play().catch(e => console.log('Sound play blocked:', e));

        const today = new Date();
        const thirtyDaysLater = new Date(today);
        thirtyDaysLater.setDate(today.getDate() + 30);
        
        // If user joined via referral, add them to the referrals list
        const newReferral: Referral = {
          id: `ref-${Date.now()}`,
          email: currentEmail,
          selfieUrl: selfieImage || '',
          idDocName: finalIdDocName,
          idDocUrl: finalIdDocUrl,
          popDocName: finalPopDocName,
          popDocUrl: finalPopDocUrl,
          status: 'Pending',
          date: today.toISOString().split('T')[0],
          activatedPlan: selectedPlan,
          expiryDate: thirtyDaysLater.toISOString().split('T')[0],
          isFrozen: false,
          referrerEmail: referrerEmail,
        };

        setReferrals((prev) => [newReferral, ...prev]);
        saveReferralToFirestore(newReferral);

        // Update user account with remembered docs
        setRegisteredUsers((prev) =>
          prev.map((u) =>
            u.email === currentEmail
              ? {
                  ...u,
                  subscriptionState: selectedPlan,
                  selfieImage: selfieImage || u.selfieImage,
                  idDocName: finalIdDocName,
                  idDocUrl: finalIdDocUrl,
                  popDocName: finalPopDocName,
                  popDocUrl: finalPopDocUrl,
                }
              : u
          )
        );
        
        setActivationStep('success');
      }, 3000);
    } catch (err) {
      console.error('Error processing files:', err);
      alert('Error processing document uploads. Please try again.');
      setActivationStep('kyc');
    }
  };

  const handleToggleFreezeReferral = (id: string) => {
    setReferrals((prev) =>
      prev.map((ref) => {
        if (ref.id === id) {
          const updated = { ...ref, isFrozen: !ref.isFrozen };
          saveReferralToFirestore(updated);
          return updated;
        }
        return ref;
      })
    );
  };

  const handleToggleDisableAccount = () => {
    if (!currentEmail) return;
    const isNowDisabled = !registeredUsers.find(u => u.email === currentEmail)?.isDisabled;
    
    setRegisteredUsers((prev) =>
      prev.map((u) =>
        u.email === currentEmail ? { ...u, isDisabled: isNowDisabled } : u
      )
    );

    if (isNowDisabled) {
      alert('Your account has been disabled. You will be logged out.');
      handleLogout();
    }
  };



  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('Firebase signOut notice:', err);
    }
    setAuthMode('login');
    setCurrentEmail('');
    setSelfieImage(null);
    setIdDocFile(null);
    setIdDocUrl(null);
    setIdDocName('');
    setPopFile(null);
    setPopDocUrl(null);
    setPopDocName('');
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editContact.trim()) {
      alert('Contact number is required.');
      return;
    }
    
    // Validate profile completeness
    const user = registeredUsers.find(u => u.email === currentEmail);
    if (!user) return;
    if (!editExperience || editExperience.length === 0) {
      alert('At least one experience entry is required.');
      return;
    }
    if (!editReferences || editReferences.length === 0) {
      alert('At least one reference is required.');
      return;
    }
    if (!selfieImage) {
      alert('A profile picture (selfie) is required for account visibility.');
      return;
    }

    // Check picture update constraint (once a month)
    if (user.profileLastUpdated && (new Date().getTime() - new Date(user.profileLastUpdated).getTime() < 30 * 24 * 60 * 60 * 1000)) {
      alert('Profile picture can only be updated once a month.');
      return;
    }

    const updatedUser: UserAccount = {
      ...user,
      firstName: editFirstName,
      lastName: editLastName,
      dob: editDob,
      contact: editContact,
      location: editLocation,
      educationLevel: editEducationLevel,
      workingTrades: editWorkingTrades,
      gigCategories: editGigCategories,
      experience: editExperience,
      references: editReferences,
      isLocked: true,
      profileLastUpdated: new Date().toISOString(),
    };

    setRegisteredUsers((prev) =>
      prev.map((u) => (u.email === currentEmail ? updatedUser : u))
    );
    saveUserToFirestore(updatedUser);

    setIsEditingProfile(false);
    alert('Profile saved and locked!');
  };

  const handleAutoFillLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const locName = await reverseGeocode(latitude, longitude);
          setEditLocation(locName);
        } catch {
          setEditLocation(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        }
      },
      (err) => {
        console.warn('Auto-fill location notice:', err);
        setErrorMessage('Unable to retrieve your location automatically.');
      }
    );
  };

  const handleToggleOnline = () => {
    if (!isOnline && !selfieImage) {
      alert('A profile picture (selfie) is required to go online and be visible to others.');
      setActiveView('profile');
      setIsEditingProfile(true);
      return;
    }
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    
    if (currentEmail) {
      const user = registeredUsers.find(u => u.email === currentEmail);
      const updated: UserAccount = user
        ? { ...user, isOnline: newStatus, lat: position?.lat || user.lat || 0, lng: position?.lng || user.lng || 0, location: locationName || user.location || '' }
        : {
            email: currentEmail,
            password: '',
            subscriptionState: subscriptionState,
            selfieImage: selfieImage,
            idDocName: null,
            popDocName: null,
            isDisabled: false,
            isFrozen: false,
            referredBy: referralCode,
            isOnline: newStatus,
            lat: position?.lat || 0,
            lng: position?.lng || 0,
            location: locationName || '',
            workingTrade: 'Seeker',
            firstName: currentEmail.split('@')[0],
            lastName: '',
          };

      setRegisteredUsers(prev => {
        const exists = prev.some(u => u.email === currentEmail);
        return exists ? prev.map(u => u.email === currentEmail ? updated : u) : [...prev, updated];
      });
      saveUserToFirestore(updated);
    }
  };

  const handleAutoFillGigLocation = () => {
    if (position) {
      setNewGigLat(position.lat);
      setNewGigLng(position.lng);
      setNewGigLocation(locationName || `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`);
    } else {
      alert('Unable to retrieve your current location. Please ensure GPS is enabled.');
    }
  };

  const handleCreateGigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingGig(true);

    // 2 second delay as requested
    await new Promise(resolve => setTimeout(resolve, 2000));

    const newGig: Gig = {
      id: `gig-${Date.now()}`,
      title: newGigTitle,
      details: newGigDetails,
      date: newGigDate,
      isImmediate: newGigIsImmediate,
      budget: newGigBudget,
      location: newGigLocation,
      lat: newGigLat || position?.lat || 0,
      lng: newGigLng || position?.lng || 0,
      experience: newGigExperience,
      creatorEmail: currentEmail,
      createdAt: new Date().toISOString(),
      status: 'Active',
    };

    setGigs((prev) => [newGig, ...prev]);
    saveGigToFirestore(newGig);
    setShowCreateGigModal(false);
    setIsCreatingGig(false);
    
    // Switch to map view and focus on new gig
    setActiveView('map');
    if (newGig.lat && newGig.lng && mapRef.current) {
      mapRef.current.setView([newGig.lat, newGig.lng], 16, { animate: true });
    }

    // Reset form
    setNewGigTitle('');
    setNewGigDetails('');
    setNewGigDate('');
    setNewGigIsImmediate(false);
    setNewGigBudget('');
    setNewGigLocation('');
    setNewGigExperience('');
    setNewGigLat(null);
    setNewGigLng(null);
    
    setPopupMessage({
      type: 'congrats',
      text: 'Gig post is now live on the map for all using the app to see!'
    });
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      alert('Please provide email and password.');
      return;
    }
    if (!acceptTerms) {
      alert('You must accept the Terms and Conditions to register.');
      return;
    }

    const existing = registeredUsers.find((u) => u.email === authEmail);
    if (existing) {
      alert('Email already registered. Please login.');
      setAuthMode('login');
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, authEmail, authPassword);
    } catch (err: any) {
      console.warn('Firebase Auth register notice:', err?.message);
    }

    const newAccount: UserAccount = {
      email: authEmail,
      password: authPassword,
      subscriptionState: 'none',
      selfieImage: null,
      idDocName: null,
      popDocName: null,
      isDisabled: false,
      isFrozen: false,
      referredBy: referralCode, // Store referral code at signup
    };
    setRegisteredUsers((prev) => [...prev, newAccount]);
    saveUserToFirestore(newAccount);

    localStorage.setItem('last_auth_email', authEmail);
    localStorage.setItem('last_auth_password', authPassword);
    
    setCurrentEmail(authEmail);
    setAuthMode('authenticated');
    setIsFirstTimeUser(true); // Trigger guidance
    setPopupMessage({ type: 'congrats', text: 'Congratulations! Your account has been successfully created.' });
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, authEmail, authPassword);
    } catch (err: any) {
      console.warn('Firebase Auth login notice:', err?.message);
    }

    const found = registeredUsers.find(
      (u) => u.email === authEmail && u.password === authPassword
    );

    if (!found && registeredUsers.length > 0) {
      alert('Invalid email or password. Please try again.');
      return;
    }

    if (found && found.isDisabled) {
      alert('This account has been disabled. Please contact support.');
      return;
    }

    // Restore user profile data if found
    if (found) {
      setSubscriptionState(found.subscriptionState);
      setSelfieImage(found.selfieImage);
    }

    localStorage.setItem('last_auth_email', authEmail);
    localStorage.setItem('last_auth_password', authPassword);

    setCurrentEmail(authEmail);
    setAuthMode('authenticated');
    setPopupMessage({ type: 'welcome', text: `Welcome Back, ${authEmail || 'User'}!` });
  };

  const handleUpdateReferralStatus = (id: string, status: 'Approved' | 'Rejected') => {
    setReferrals((prev) =>
      prev.map((ref) => {
        if (ref.id === id) {
          const updated = { ...ref, status };
          saveReferralToFirestore(updated);
          return updated;
        }
        return ref;
      })
    );
  };

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      if (user && user.email) {
        setCurrentEmail(user.email);
        setAuthMode('authenticated');
        const existing = registeredUsers.find(u => u.email === user.email);
        const userAcc: UserAccount = existing || {
          email: user.email,
          password: '',
          subscriptionState: 'none',
          selfieImage: user.photoURL || null,
          idDocName: null,
          popDocName: null,
          isDisabled: false,
          isFrozen: false,
          referredBy: referralCode,
          firstName: user.displayName?.split(' ')[0] || '',
          lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
        };
        setRegisteredUsers(prev => prev.some(u => u.email === user.email) ? prev : [...prev, userAcc]);
        saveUserToFirestore(userAcc);
        setPopupMessage({ type: 'welcome', text: `Welcome, ${user.displayName || user.email}!` });
      }
    } catch (err: any) {
      console.warn('Google Sign-In notice:', err);
      if (err?.code !== 'auth/popup-closed-by-user') {
        alert('Google Sign-In: ' + (err?.message || 'Error signing in with Google.'));
      }
    }
  };

  // Access control status
  const userRefRecord = referrals.find(r => r.email === currentEmail);
  const isMaster = currentEmail === 'timegig2026@gmail.com';
  
  // Status: 'approved' | 'pending' | 'rejected' | 'frozen' | 'none'
  const accessStatus = isMaster 
    ? 'approved' 
    : userRefRecord 
      ? userRefRecord.isFrozen 
        ? 'frozen' 
        : userRefRecord.status.toLowerCase() as 'approved' | 'pending' | 'rejected'
      : 'none';

  // Main Return Block
  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-white">
      {/* GLOBAL BACKGROUND MAP (The Wallpaper) */}
      <div className="fixed inset-0 z-0">
        <div 
          ref={authMode !== 'authenticated' ? authMapContainerRef : null} 
          className={`absolute inset-0 grayscale-[20%] ${authMode !== 'authenticated' ? 'block' : 'hidden'}`}
        />
        {/* Blur overlay for non-map views or auth screens */}
        {(authMode !== 'authenticated' || activeView !== 'map') && (
          <div className="absolute inset-0 backdrop-blur-[6px] bg-white/10 z-[1]" />
        )}
      </div>

      {/* Auth Screen */}
      {authMode !== 'authenticated' && (
        <div className="relative z-10 w-full h-full flex items-center justify-center p-4">
          {/* Smaller Signup / Login Card on top */}
          <div className="relative z-10 w-11/12 max-w-sm bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/40 p-6 space-y-5 animate-in fade-in zoom-in duration-300">
          <div className="text-center space-y-1">
            {authMode === 'login' ? (
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-md relative group">
                <ShieldCheck className="w-6 h-6" />
                <button 
                  type="button"
                  onClick={() => setActiveHelp(helpContent.auth)}
                  className="absolute -top-2 -right-2 p-1.5 bg-white text-blue-600 rounded-full shadow-md border border-gray-100 hover:scale-110 transition-transform"
                  title="Help"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 mb-2">
                <h2 className="text-3xl font-black text-blue-600 tracking-tighter">TimeGiG</h2>
                <div className="h-0.5 w-12 bg-blue-600 rounded-full opacity-30" />
              </div>
            )}
            <h1 className="text-xl font-extrabold text-gray-900">
              {authMode === 'signup' ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p className="text-xs text-gray-500">
              {authMode === 'signup' ? 'Register with email & password' : 'Login with your credentials'}
            </p>
          </div>

          {authMode === 'signup' ? (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="terms"
                  required
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="terms" className="text-[11px] text-gray-600 select-none">
                  I accept the <span className="text-blue-600 font-semibold">Terms and Conditions</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs shadow-lg shadow-blue-500/25 transition-all"
              >
                Register & Join
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink mx-2 text-[10px] text-gray-400 font-medium uppercase">Or</span>
                <div className="flex-grow border-t border-gray-200"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full py-2.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-medium rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Continue with Google
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className="text-xs text-blue-600 font-semibold hover:underline"
                >
                  Already have an account? Login
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs shadow-lg shadow-blue-500/25 transition-all"
              >
                Login
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink mx-2 text-[10px] text-gray-400 font-medium uppercase">Or</span>
                <div className="flex-grow border-t border-gray-200"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full py-2.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-medium rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Continue with Google
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className="text-xs text-blue-600 font-semibold hover:underline"
                >
                  Need an account? Register
                </button>
              </div>
            </form>
          )}
          </div>
        </div>
      )}



      {/* Main App Content */}
      <div className="relative z-10 w-full h-full flex flex-col">
      {/* Access Control Overlay (Blocks use of app until approved) */}
      {!isMaster && (accessStatus === 'pending' || accessStatus === 'rejected' || accessStatus === 'frozen') && (
        <div className="fixed inset-0 z-[60] bg-white/80 backdrop-blur-xl flex items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <div className="max-w-sm space-y-6">
            <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center shadow-lg ${
              accessStatus === 'pending' ? 'bg-amber-100 text-amber-600' :
              accessStatus === 'rejected' ? 'bg-red-100 text-red-600' :
              'bg-blue-100 text-blue-600'
            }`}>
              {accessStatus === 'pending' && <Clock className="w-10 h-10 animate-pulse" />}
              {accessStatus === 'rejected' && <XCircle className="w-10 h-10" />}
              {accessStatus === 'frozen' && <Snowflake className="w-10 h-10" />}
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                {accessStatus === 'pending' && 'Awaiting Approval'}
                {accessStatus === 'rejected' && 'Application Rejected'}
                {accessStatus === 'frozen' && 'Account Frozen'}
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                {accessStatus === 'pending' && `Hi ${currentEmail}, your subscription is currently pending approval from your referring tenant. Please check back later.`}
                {accessStatus === 'rejected' && 'Unfortunately, your subscription application has been rejected. Please contact support for more information.'}
                {accessStatus === 'frozen' && 'Your account has been temporarily frozen. Please contact your administrator to resolve this.'}
              </p>
            </div>

            <div className="pt-4 flex flex-col gap-3">
              <button
                onClick={handleLogout}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
              {accessStatus === 'pending' && (
                <p className="text-[10px] text-gray-400 font-medium">Your verification is being processed by the system.</p>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Pop-up congratulations or welcome back */}
      {popupMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/40 w-full max-w-sm p-6 text-center space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md">
              <Award className="w-8 h-8 animate-bounce" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-gray-900">
                {popupMessage.type === 'congrats' ? 'Welcome & Congratulations!' : 'Welcome Back!'}
              </h3>
              <p className="text-xs text-gray-600">{popupMessage.text}</p>
            </div>
            <button
              onClick={() => setPopupMessage(null)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs shadow-md transition-all"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Map View (always active in background) */}
      <div
        ref={mapContainerRef}
        className={`absolute inset-0 z-0 bottom-[calc(76px+env(safe-area-inset-bottom))] ${authMode === 'authenticated' ? 'block' : 'hidden'}`}
      />

      {/* Top Bar: Search Bar & Status (Shown on map and gigs views) */}
      {(activeView === 'map' || activeView === 'gigs') && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-11/12 max-w-xl flex flex-col items-center">
          <form onSubmit={handleSearchSubmit} className="w-full relative flex items-center shadow-2xl">
            {/* Removed Search icon as per user request to clean up search box */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchSuggestions.length > 0) setShowSuggestions(true);
              }}
              placeholder="Search area, street, location, province..."
              className="w-full pl-6 pr-20 py-3.5 bg-white/95 backdrop-blur-md rounded-2xl border border-gray-200 text-gray-900 text-sm md:text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white shadow-md transition-all"
            />
            <div className="absolute right-4 flex items-center gap-1.5">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchSuggestions([]);
                    setShowSuggestions(false);
                    if (searchMarkerRef.current && mapRef.current) {
                      mapRef.current.removeLayer(searchMarkerRef.current);
                      searchMarkerRef.current = null;
                    }
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {showSuggestions && searchSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-md rounded-xl border border-gray-200 shadow-xl overflow-hidden z-30 max-h-64 overflow-y-auto">
                {searchSuggestions.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectLocation(item.lat, item.lon, item.display_name)}
                    className="px-4 py-3 text-xs md:text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-900 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors flex items-start gap-2"
                  >
                    <span className="line-clamp-2">{item.display_name}</span>
                  </div>
                ))}
              </div>
            )}
          </form>

          <div className="mt-2 bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-full shadow-md border border-gray-200/80 flex items-center gap-2">
            {status === 'locating' && <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />}
            {status === 'located' && <Navigation className="w-3.5 h-3.5 text-blue-600 fill-blue-600" />}
            {(status === 'error' || status === 'denied') && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
            <span className="text-xs text-gray-700 font-medium">
              {status === 'locating' && 'Locating you...'}
              {status === 'located' && (locationName ? `Current Location: ${locationName}` : position ? `Current Location: ${position.lat.toFixed(3)}, ${position.lng.toFixed(3)}` : 'Location active')}
              {status === 'denied' && 'Location permission denied'}
              {status === 'error' && (errorMessage || 'Location unavailable')}
            </span>
          </div>
        </div>
      )}

      {/* Floating Bubble Cluster (Zoom, Satellite toggle, Recenter) - Bottom Right (Shown on map and gigs views) */}
      {(activeView === 'map' || activeView === 'gigs') && (
        <div className="absolute bottom-24 right-6 z-20 flex flex-col items-center gap-3">
          {/* Create a Post Icon (Smaller compact icon) */}
          <button
            onClick={() => setShowCreateGigModal(true)}
            className="w-10 h-10 bg-blue-600 text-white rounded-2xl shadow-lg flex items-center justify-center hover:bg-blue-700 transition-all hover:scale-110 active:scale-95 group relative border border-white/80"
            title="Create a Post"
            aria-label="Create a Post"
          >
            <Plus className="w-5 h-5 text-white" />
            <span className="absolute right-12 bg-gray-900/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-md">
              Create Post
            </span>
          </button>
          <div className="flex flex-col bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          <button
            onClick={toggleSatellite}
            className={`p-3 transition-colors flex items-center justify-center ${
              isSatellite ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
            }`}
            title={isSatellite ? 'Switch to Street View' : 'Switch to Satellite View'}
            aria-label="Toggle Satellite View"
          >
            <Layers className="w-5 h-5" />
          </button>
          <button
            onClick={handleZoomIn}
            className="p-3 text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-center"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-3 text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-center"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <Minus className="w-5 h-5" />
          </button>
          <button
            onClick={handleRecenter}
            className={`p-3 transition-colors flex items-center justify-center ${
              isFollowing ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-100'
            }`}
            title="Recenter on my location"
            aria-label="Recenter on my location"
          >
            <Locate className="w-5 h-5" />
          </button>
          </div>
        </div>
      )}

      {/* Tenant Portal View */}
      {activeView === 'tenant-portal' && (
        <div className="absolute inset-0 z-10 bg-transparent overflow-y-auto p-4 md:p-6 pb-[calc(112px+env(safe-area-inset-bottom))]">
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-white/40">
              <div className="flex items-center gap-2">
                {selfieImage ? (
                  <img src={selfieImage} alt="Tenant Avatar" className="w-10 h-10 rounded-lg object-cover shadow-sm border-2 border-emerald-500" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-base shadow-sm">
                    TP
                  </div>
                )}
                <div>
                  <h1 className="text-lg font-extrabold text-gray-900 leading-tight">Tenant Portal</h1>
                  <p className="text-[10px] text-emerald-600 font-semibold leading-tight">Tenant Sub Active (R299,99/mo)</p>
                  {locationName && (
                    <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5 font-medium">
                      <MapPin className="w-2.5 h-2.5 text-blue-600" /> {locationName}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveHelp(helpContent.tenant)}
                  className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors shadow-sm"
                  title="Help Guide"
                >
                  <HelpCircle className="w-5 h-5" />
                </button>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded-full shadow-sm flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Verified
                </span>
              </div>
            </div>

            {/* Total Profit Balance Card */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 rounded-2xl shadow-lg border border-emerald-400/20 text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 transition-transform group-hover:scale-110">
                <DollarSign className="w-24 h-24" />
              </div>
              <div className="relative z-10 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Tenant Total Profit Balance
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black">R {(userSubProfit + tenantSubProfit).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Referral Link Card */}
            <div className="bg-white/80 backdrop-blur-md p-3 rounded-lg shadow-sm border border-white/40 space-y-1.5">
              <h3 className="text-[11px] font-bold text-gray-900">Your Tenant Referral Link</h3>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={tenantReferralLink}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[10px] text-gray-700 font-mono select-all"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(tenantReferralLink);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-semibold flex items-center gap-1 shadow-sm transition-all flex-shrink-0"
                >
                  {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[9px] text-gray-500">Share this link to invite users and grow your referral network.</p>
            </div>

            {/* Stats: Total Referrals (Clickable) */}
            <div className="grid grid-cols-1 gap-3">
              <div
                onClick={() => setShowReferralsModal(true)}
                className="bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-white/40 hover:border-blue-500 cursor-pointer transition-all group flex items-center justify-between"
                title="Click to view all referrals"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">Total Network Signups</h3>
                    <p className="text-xs text-gray-500">Manage KYC, approvals, and activations</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-gray-900">
                    {currentEmail === 'timegig2026@gmail.com' 
                      ? registeredUsers.length - 1 
                      : registeredUsers.filter(u => u.referredBy === getReferralCode(currentEmail)).length}
                  </div>
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">View Details</p>
                </div>
              </div>
            </div>

            {/* Tenant Configuration (Limits & Fees) */}
            {subscriptionState === 'tenant' && (
              <div className="bg-white/80 backdrop-blur-md p-4 rounded-lg shadow-sm border border-white/40 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-bold text-gray-900">
                      {currentEmail === 'timegig2026@gmail.com' ? 'System Configuration' : 'Network Settings'}
                    </h3>
                  </div>
                  <span className="text-[10px] text-gray-400 italic">Settings for your referrals</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Fees Configuration */}
                    <div className="relative space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Referral User Fee (R)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={userSubFee}
                        onChange={(e) => {
                          setUserSubFee(Number(e.target.value));
                          setFeeUpdated(true);
                          setTimeout(() => setFeeUpdated(false), 2000);
                        }}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      {feeUpdated && (
                        <div className="absolute -top-1 right-0 text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded flex items-center gap-0.5 animate-bounce">
                          <CheckCircle2 className="w-2 h-2" /> Success
                        </div>
                      )}
                    </div>
                    <div className="relative space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Free Trial Days</label>
                      <input
                        type="number"
                        min="0"
                        value={trialDays}
                        onChange={(e) => setTrialDays(Number(e.target.value))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="relative space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Referral Tenant Fee (R)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={tenantSubFee}
                        onChange={(e) => {
                          setTenantSubFee(Number(e.target.value));
                          setFeeUpdated(true);
                          setTimeout(() => setFeeUpdated(false), 2000);
                        }}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      {feeUpdated && (
                        <div className="absolute -top-1 right-0 text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded flex items-center gap-0.5 animate-bounce">
                          <CheckCircle2 className="w-2 h-2" /> Success
                        </div>
                      )}
                    </div>

                  {/* Bank Details Configuration */}
                  <div className="col-span-2 pt-2 border-t border-gray-100">
                    <h4 className="text-[10px] font-bold text-gray-900 uppercase mb-3 flex items-center gap-2">
                      <CreditCard className="w-3 h-3 text-emerald-600" /> Payout Details
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Bank Name</label>
                        <input
                          type="text"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          placeholder="e.g. FNB, ABSA"
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Account Holder</label>
                        <input
                          type="text"
                          value={accountHolder}
                          onChange={(e) => setAccountHolder(e.target.value)}
                          placeholder="Full Name"
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Account Number</label>
                        <input
                          type="text"
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                          placeholder="123456789"
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Branch Code</label>
                        <input
                          type="text"
                          value={branchCode}
                          onChange={(e) => setBranchCode(e.target.value)}
                          placeholder="e.g. 250655"
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Limits Configuration (Master Only) */}
                  {currentEmail === 'timegig2026@gmail.com' && (
                    <>
                      <div className="space-y-1.5 col-span-1 pt-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Global Tenant Limit</label>
                        <input
                          type="number"
                          value={tenantLimitConfig}
                          onChange={(e) => setTenantLimitConfig(Number(e.target.value))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1.5 col-span-1 pt-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Global User Limit</label>
                        <input
                          type="number"
                          value={userLimitConfig}
                          onChange={(e) => setUserLimitConfig(Number(e.target.value))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-[10px] text-blue-700 leading-relaxed font-medium">
                    <span className="font-bold">Info:</span> {currentEmail === 'timegig2026@gmail.com' 
                      ? 'You can set global referral limits and manage your network fees. These fees are what your direct referrals will pay.'
                      : 'Set the monthly subscription fees for users and tenants who join via your link. These are your passive income sources.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full Screen Referrals Review Modal */}
      {showReferralsModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex flex-col p-2 md:p-4 overflow-y-auto">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/40 w-full max-w-4xl mx-auto my-auto overflow-hidden flex flex-col max-h-[95vh]">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-1.5">
                <div className="p-1 bg-blue-100 text-blue-600 rounded-md">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 leading-tight">Referrals & KYC Verification</h2>
                  <p className="text-[9px] text-gray-500 leading-tight">Review email, selfie, ID, and payment status</p>
                </div>
              </div>
              <button
                onClick={() => setShowReferralsModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {(() => {
                const myCode = getReferralCode(currentEmail);
                const isMaster = currentEmail === 'timegig2026@gmail.com';
                
                // Get all relevant signups from registeredUsers
                const relevantUsers = isMaster 
                  ? registeredUsers.filter(u => u.email !== currentEmail)
                  : registeredUsers.filter(u => u.referredBy === myCode);

                const tenantCount = relevantUsers.filter(u => u.subscriptionState === 'tenant').length;
                const userCount = relevantUsers.filter(u => u.subscriptionState === 'user').length;
                
                const tenantLimit = isMaster ? 1000 : tenantLimitConfig;
                const userLimit = isMaster ? 1000 : userLimitConfig;

                return (
                  <>
                    {/* Stats Display */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                      {isMaster ? (
                         <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 shadow-sm">
                           <h4 className="text-xs font-bold text-purple-900 mb-2">Master Tenant Overview</h4>
                           <div className="text-sm">Total Referrals: {relevantUsers.length}</div>
                           <div className="text-sm">Total Monthly Profit: R{referrals.reduce((sum, r) => sum + (r.status === 'Approved' ? (r.activatedPlan === 'user' ? userSubFee : tenantSubFee) : 0), 0).toFixed(2)}</div>
                         </div>
                      ) : (
                        <>
                          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex flex-col items-center">
                            <span className="text-[9px] font-bold text-emerald-600 uppercase">Tenant Referrals</span>
                            <div className="text-lg font-black text-emerald-800">{tenantCount} / {tenantLimit}</div>
                            <div className="w-full bg-emerald-200 h-1 rounded-full mt-1 overflow-hidden">
                              <div className="bg-emerald-600 h-full transition-all" style={{ width: `${Math.min((tenantCount/tenantLimit)*100, 100)}%` }} />
                            </div>
                          </div>
                          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex flex-col items-center">
                            <span className="text-[9px] font-bold text-blue-600 uppercase">User Referrals</span>
                            <div className="text-lg font-black text-blue-800">{userCount} / {userLimit}</div>
                            <div className="w-full bg-blue-200 h-1 rounded-full mt-1 overflow-hidden">
                              <div className="bg-blue-600 h-full transition-all" style={{ width: `${Math.min((userCount/userLimit)*100, 100)}%` }} />
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {relevantUsers.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 text-xs">No referrals found yet.</div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {relevantUsers.map((user) => {
                      const refData = referrals.find(r => r.email === user.email);
                      return (
                        <div
                          key={user.email}
                          className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:shadow-md transition-all"
                        >
                          <div className="flex items-center gap-3">
                            {refData?.selfieUrl ? (
                              <img
                                src={refData.selfieUrl}
                                alt="Selfie"
                                onClick={() => setViewingDoc({ url: refData.selfieUrl, title: `Selfie: ${refData.email}` })}
                                className={`w-12 h-12 rounded-xl object-cover border-2 shadow-sm flex-shrink-0 cursor-pointer hover:scale-105 transition-transform ${refData.isFrozen ? 'border-blue-300 grayscale' : 'border-blue-500'}`}
                                title="Click to view full selfie"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-gray-100 text-gray-400 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 flex-shrink-0">
                                <User className="w-5 h-5" />
                                <span className="text-[6px] font-bold uppercase mt-0.5">Missing</span>
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-gray-900 text-sm">{user.email}</h3>
                                {refData ? (
                                  <>
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                        refData.status === 'Approved'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : refData.status === 'Rejected'
                                          ? 'bg-red-100 text-red-800'
                                          : 'bg-amber-100 text-amber-800'
                                      }`}
                                    >
                                      {refData.status}
                                    </span>
                                    {refData.isFrozen && (
                                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1">
                                        <Snowflake className="w-2.5 h-2.5" /> Frozen
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[9px] font-bold border border-gray-200">
                                    Awaiting KYC
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold ${user.subscriptionState === 'tenant' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : user.subscriptionState === 'user' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                                  {user.subscriptionState === 'tenant' ? 'Tenant Sub' : user.subscriptionState === 'user' ? 'User Sub' : 'No Sub'}
                                </span>
                                {refData && (
                                  <div className="flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                                    <Clock className="w-2.5 h-2.5" /> Expiry: {refData.expiryDate}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {refData ? (
                              <>
                                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2 py-1.5 rounded-lg text-[10px] text-gray-700">
                                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                                  <span className="font-medium truncate max-w-[100px]">{refData.idDocName}</span>
                                  <button
                                    onClick={() => {
                                      if (refData.idDocUrl) {
                                        setViewingDoc({ url: refData.idDocUrl, title: `ID Document: ${refData.idDocName}` });
                                      } else {
                                        alert(`ID Document content not available for older referrals: ${refData.idDocName}`);
                                      }
                                    }}
                                    className="p-0.5 hover:bg-gray-200 rounded text-blue-600"
                                    title="View ID Full"
                                  >
                                    <Eye className="w-3 h-3" />
                                  </button>
                                </div>

                                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2 py-1.5 rounded-lg text-[10px] text-gray-700">
                                  <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="font-medium truncate max-w-[100px]">{refData.popDocName}</span>
                                  <button
                                    onClick={() => {
                                      if (refData.popDocUrl) {
                                        setViewingDoc({ url: refData.popDocUrl, title: `Proof of Payment: ${refData.popDocName}` });
                                      } else {
                                        alert(`POP content not available for older referrals: ${refData.popDocName}`);
                                      }
                                    }}
                                    className="p-0.5 hover:bg-gray-200 rounded text-emerald-600"
                                    title="View POP Full"
                                  >
                                    <Eye className="w-3 h-3" />
                                  </button>
                                </div>
                              </>
                            ) : (
                              <p className="text-[10px] text-gray-400 italic">Documents not yet submitted</p>
                            )}
                          </div>

                          {refData && (currentEmail === 'timegig2026@gmail.com' || subscriptionState === 'tenant') && (
                            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                              <button
                                onClick={() => handleToggleFreezeReferral(refData.id)}
                                className={`px-3 py-1.5 font-semibold rounded-lg text-[10px] shadow-sm transition-all flex items-center gap-1 ${
                                  refData.isFrozen 
                                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                                title={refData.isFrozen ? 'Unfreeze Account' : 'Freeze Account'}
                              >
                                {refData.isFrozen ? <RefreshCw className="w-3.5 h-3.5" /> : <Snowflake className="w-3.5 h-3.5" />}
                                {refData.isFrozen ? 'Unfreeze' : 'Freeze'}
                              </button>
                              <button
                                onClick={() => handleUpdateReferralStatus(refData.id, 'Approved')}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-[10px] shadow-sm transition-all flex items-center gap-1"
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> Approve
                              </button>
                              <button
                                onClick={() => handleUpdateReferralStatus(refData.id, 'Rejected')}
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-[10px] shadow-sm transition-all flex items-center gap-1"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Reject
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                </>
              );
            })()}
          </div>

            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowReferralsModal(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg text-[10px] transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Seekers View */}
      {activeView === 'seekers' && (
        <div className="absolute inset-0 z-10 bg-transparent overflow-y-auto p-6 md:p-10 pb-[calc(112px+env(safe-area-inset-bottom))]">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900">Seekers Directory</h1>
                <p className="text-sm text-gray-500">Find active service providers, verified tenants, and seekers in your area</p>
              </div>
              <div className="flex items-center gap-3">
                {/* On and Off Icon in Seekers Feature */}
                <button
                  onClick={handleToggleOnline}
                  className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl transition-all shadow-md font-bold text-xs border ${
                    isOnline
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-emerald-500/25 ring-2 ring-emerald-500/30'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  title={isOnline ? 'Click on and off icon to go Offline' : 'Click on and off icon to appear in Seekers Directory'}
                >
                  <div className={`p-1 rounded-full ${isOnline ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    <Power className={`w-4 h-4 ${isOnline ? 'animate-pulse' : ''}`} />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[9px] uppercase tracking-wider font-extrabold opacity-80 leading-tight">
                      {isOnline ? 'ON (READY)' : 'OFF (IDLE)'}
                    </span>
                    <span className="text-xs font-black leading-tight">
                      {isOnline ? 'Ready to get Hired' : 'Appear as Seeker'}
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveHelp(helpContent.seekers)}
                  className="p-3 bg-blue-100 text-blue-600 rounded-2xl hover:bg-blue-200 transition-colors shadow-md"
                  title="Directory Help"
                >
                  <HelpCircle className="w-6 h-6" />
                </button>
                <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                  <Users className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Current User Card when turned ON via on/off icon */}
            {isOnline && (
              <div className="bg-gradient-to-r from-emerald-50/90 to-blue-50/90 p-5 rounded-3xl shadow-md border-2 border-emerald-500 flex items-center justify-between relative overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider rounded-bl-2xl shadow-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                  READY TO GET HIRED
                </div>
                <div className="flex items-center gap-4">
                  {selfieImage ? (
                    <img src={selfieImage} alt="Your profile" className="w-14 h-14 rounded-2xl object-cover shadow-sm border-2 border-emerald-500" />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xl shadow-sm border border-emerald-300">
                      {editFirstName ? editFirstName[0].toUpperCase() : (currentEmail ? currentEmail[0].toUpperCase() : 'U')}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-gray-900 text-base">
                        {editFirstName || editLastName ? `${editFirstName} ${editLastName}` : currentEmail}
                      </h3>
                      <span className="px-2 py-0.5 bg-blue-600 text-white text-[9px] font-black rounded-full uppercase tracking-tight">You</span>
                    </div>
                    <p className="text-xs text-emerald-700 font-bold mt-0.5">
                      {editWorkingTrades && editWorkingTrades.length > 0 ? editWorkingTrades.join(', ') : 'Seeker • Ready for Hire'}
                    </p>
                    <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-1 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" /> {editLocation || locationName || 'Location active on map'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="px-3 py-1.5 bg-emerald-500 text-white font-black text-[10px] rounded-xl shadow-sm flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                    LIVE ON MAP
                  </span>
                  <span className="text-[10px] font-bold text-gray-500">Visible to Clients</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {registeredUsers.filter(u => u.isOnline && u.email !== currentEmail).map((seeker, idx) => (
                <div key={idx} onClick={() => setViewingSeekerProfile(seeker)} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-between cursor-pointer hover:border-blue-300 transition-colors group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-emerald-500 w-2 h-2 rounded-full animate-pulse"></div>
                  </div>
                  <div className="flex items-center gap-4">
                    {seeker.selfieImage ? (
                      <img src={seeker.selfieImage} alt={seeker.firstName} className="w-12 h-12 rounded-xl object-cover shadow-sm" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        {seeker.firstName?.[0] || 'U'}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">{seeker.firstName} {seeker.lastName}</h3>
                      <p className="text-xs text-gray-500">{seeker.workingTrade || 'Seeker'}</p>
                      <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {seeker.location || 'Location hidden'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-lg border border-emerald-100">
                      LIVE
                    </span>
                    <span className="text-[10px] font-bold text-gray-400">★ 5.0</span>
                  </div>
                </div>
              ))}
              {!isOnline && registeredUsers.filter(u => u.isOnline && u.email !== currentEmail).length === 0 && (
                <div className="col-span-full py-12 text-center bg-white/70 backdrop-blur-sm rounded-3xl border border-dashed border-gray-300 space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center shadow-inner">
                    <Power className="w-8 h-8 text-blue-500" />
                  </div>
                  <h3 className="text-base font-extrabold text-gray-800">You are currently offline</h3>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    Click the <b>on and off icon</b> above to appear in the Seekers Directory as a seeker ready to get hired!
                  </p>
                  <button
                    onClick={handleToggleOnline}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition-all inline-flex items-center gap-2"
                  >
                    <Power className="w-4 h-4" /> Turn ON to Get Hired
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}



      {/* Profile View */}
      {activeView === 'profile' && (
        <div className="absolute inset-0 z-10 bg-transparent overflow-y-auto p-6 md:p-10 pb-[calc(112px+env(safe-area-inset-bottom))]">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/40">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <div className="flex flex-col items-center gap-2">
                  {selfieImage ? (
                    <img src={selfieImage} alt="User Profile Logo" className="w-24 h-24 rounded-2xl object-cover shadow-md border-2 border-blue-500 flex-shrink-0" />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-3xl shadow-md flex-shrink-0">
                      {editFirstName ? editFirstName[0].toUpperCase() : 'U'}
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full inline-block">
                      {currentEmail}
                    </p>
                  </div>
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">
                    {editFirstName || editLastName ? `${editFirstName} ${editLastName}` : 'User Profile'}
                  </h1>
                  <p className="text-sm font-semibold text-blue-600">
                    {subscriptionState === 'tenant' ? 'Tenant Sub (Active)' : subscriptionState === 'user' ? 'User Sub (Active)' : 'Not Activated'}
                  </p>
                  {!selfieImage && (
                    <div className="mt-2 space-y-2">
                      <p className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg animate-pulse flex items-center justify-center sm:justify-start gap-1">
                        <AlertCircle className="w-3 h-3" /> Profile Picture Missing! Please update to be visible.
                      </p>
                      <button
                        onClick={() => setIsEditingProfile(true)}
                        className="w-full sm:w-auto px-4 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg shadow-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Camera className="w-3.5 h-3.5" /> Upload Selfie Now
                      </button>
                    </div>
                  )}
                  {locationName && (
                    <p className="text-sm text-gray-500 flex items-center justify-center sm:justify-start gap-1 mt-1 font-medium">
                      <MapPin className="w-4 h-4 text-blue-600" /> {locationName}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">ID & KYC Verified successfully</p>
                </div>
                <div className="flex items-center gap-3">

                  <button
                    onClick={handleLogout}
                    className="p-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl transition-all shadow-sm flex items-center gap-2 font-semibold text-xs"
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-white/40 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900">Personal Information</h3>
                {!isEditingProfile && (
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    Edit Profile
                  </button>
                )}
              </div>

              {isEditingProfile ? (
                <>
                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">First Name</label>
                        <input
                          type="text"
                          value={editFirstName}
                          onChange={(e) => setEditFirstName(e.target.value)}
                          placeholder="e.g. John"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Surname</label>
                        <input
                          type="text"
                          value={editLastName}
                          onChange={(e) => setEditLastName(e.target.value)}
                          placeholder="e.g. Doe"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                        />
                      </div>
                    </div>

                    {/* Selfie Update Section in Profile Edit */}
                    <div className="p-4 bg-blue-50/50 rounded-2xl border-2 border-dashed border-blue-200">
                      <label className="block text-[10px] font-bold text-blue-600 uppercase mb-3 text-center">Update Profile Picture (Selfie)</label>
                      <div className="flex flex-col items-center gap-4">
                        {selfieImage ? (
                          <div className="relative w-24 h-24 rounded-xl overflow-hidden shadow-md group">
                            <img src={selfieImage} alt="Preview" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setSelfieImage(null)}
                              className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full hover:bg-black transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                            <button
                              type="button"
                              onClick={startCamera}
                              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-bold flex items-center justify-center gap-2"
                            >
                              <Camera className="w-3.5 h-3.5" /> Take Photo
                            </button>
                            <label className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 cursor-pointer">
                              <Upload className="w-3.5 h-3.5" /> Upload File
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    const reader = new FileReader();
                                    reader.onload = (ev) => setSelfieImage(ev.target?.result as string);
                                    reader.readAsDataURL(e.target.files[0]);
                                  }
                                }}
                                className="hidden"
                              />
                            </label>
                          </div>
                        )}
                        {isCameraActive && !selfieImage && (
                          <div className="relative w-full max-w-[240px] rounded-xl overflow-hidden bg-black aspect-video">
                            <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline />
                            <button
                              type="button"
                              onClick={capturePhoto}
                              className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-blue-600 text-white rounded-full font-bold text-[10px]"
                            >
                              Capture
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Education Level</label>
                        <select
                          value={editEducationLevel}
                          onChange={(e) => setEditEducationLevel(e.target.value)}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                        >
                          <option value="">Select Level</option>
                          <option value="High School">High School</option>
                          <option value="Diploma">Diploma</option>
                          <option value="Degree">Degree</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Working Trades (Select multiple)</label>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {["Electrician", "Plumber", "Carpenter", "Painter", "Gardener", "Cleaner", "Delivery", "Handyman", "Tutor", "Chef/Cook", "Driver", "Tech Support", "Construction", "Security", "Watering", "Catering", "Mowing", "Housekeeping", "Mechanic", "Babysitter", "Pet Sitter", "Photographer", "Videographer", "Graphic Designer", "Web Developer", "Writer/Editor"].map(trade => (
                            <label key={trade} className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={editWorkingTrades.includes(trade)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEditWorkingTrades([...editWorkingTrades, trade]);
                                  } else {
                                    setEditWorkingTrades(editWorkingTrades.filter(t => t !== trade));
                                  }
                                }}
                                className="rounded text-blue-600 focus:ring-blue-500"
                              />
                              {trade}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Date of Birth</label>
                        <div className="relative flex items-center">
                          <Calendar className="absolute left-3 w-4 h-4 text-gray-400" />
                          <input
                            type="date"
                            value={editDob}
                            onChange={(e) => setEditDob(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Contact Number <span className="text-red-500">*</span></label>
                        <div className="relative flex items-center">
                          <Navigation className="absolute left-3 w-4 h-4 text-gray-400" />
                          <input
                            type="tel"
                            required
                            value={editContact}
                            onChange={(e) => setEditContact(e.target.value)}
                            placeholder="+27 12 345 6789"
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Location</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1 flex items-center">
                          <MapPin className="absolute left-3 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={editLocation}
                            onChange={(e) => setEditLocation(e.target.value)}
                            placeholder="Address or coordinates"
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAutoFillLocation}
                          className="px-4 py-2.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all flex items-center gap-2 whitespace-nowrap"
                          title="Set Automatically via GPS"
                        >
                          <Locate className="w-4 h-4" /> 
                          <span className="hidden sm:inline">Auto-fill</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="submit"
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-500/25 transition-all"
                      >
                        Save Profile Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingProfile(false)}
                        className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>

                  {/* Experience Modal */}
                  {showExperienceModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                      <div className="bg-white p-6 rounded-2xl w-full max-w-sm space-y-4">
                        <h3 className="font-bold text-lg">Add Experience</h3>
                        <input
                          type="text"
                          value={newExperienceItem}
                          onChange={(e) => setNewExperienceItem(e.target.value)}
                          placeholder="e.g. 2 years as a painter"
                          className="w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-xs"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => {
                            if (newExperienceItem.trim()) {
                              setEditExperience([...editExperience, newExperienceItem]);
                              setNewExperienceItem('');
                              setShowExperienceModal(false);
                            }
                          }} className="flex-1 py-2 bg-blue-600 text-white rounded-xl">Add</button>
                          <button onClick={() => setShowExperienceModal(false)} className="flex-1 py-2 bg-gray-200 rounded-xl">Cancel</button>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Reference Modal */}
                  {showReferenceModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                      <div className="bg-white p-6 rounded-2xl w-full max-w-sm space-y-4">
                        <h3 className="font-bold text-lg">Add Reference</h3>
                        <input
                          type="text"
                          value={newReferenceItem}
                          onChange={(e) => setNewReferenceItem(e.target.value)}
                          placeholder="e.g. John Doe, 012 345 6789"
                          className="w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-xs"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => {
                            if (newReferenceItem.trim()) {
                              setEditReferences([...editReferences, newReferenceItem]);
                              setNewReferenceItem('');
                              setShowReferenceModal(false);
                            }
                          }} className="flex-1 py-2 bg-blue-600 text-white rounded-xl">Add</button>
                          <button onClick={() => setShowReferenceModal(false)} className="flex-1 py-2 bg-gray-200 rounded-xl">Cancel</button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2 pt-4">
                    <button type="button" onClick={() => setShowExperienceModal(true)} className="w-full py-2 bg-gray-100 rounded-lg text-xs font-bold">+ Add Experience ({editExperience.length})</button>
                    <button type="button" onClick={() => setShowReferenceModal(true)} className="w-full py-2 bg-gray-100 rounded-lg text-xs font-bold">+ Add Reference ({editReferences.length})</button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">First Name</p>
                      <p className="text-xs font-bold text-gray-900">{editFirstName || '-'}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Surname</p>
                      <p className="text-xs font-bold text-gray-900">{editLastName || '-'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Date of Birth</p>
                      <p className="text-xs font-bold text-gray-900">{editDob || '-'}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Contact Number</p>
                      <p className="text-xs font-bold text-gray-900">{editContact || '-'}</p>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Location</p>
                    <p className="text-xs font-bold text-gray-900">{editLocation || '-'}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Education Level</p>
                    <p className="text-xs font-bold text-gray-900">{editEducationLevel || '-'}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Working Trades</p>
                    <p className="text-xs font-bold text-gray-900">{editWorkingTrades.length > 0 ? editWorkingTrades.join(', ') : '-'}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Experience</p>
                    <div className="text-xs font-bold text-gray-900 space-y-1">
                      {editExperience && editExperience.length > 0 ? editExperience.map((exp, i) => <p key={i}>• {exp}</p>) : '-'}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">References</p>
                    <div className="text-xs font-bold text-gray-900 space-y-1">
                      {editReferences && editReferences.length > 0 ? editReferences.map((ref, i) => <p key={i}>• {ref}</p>) : '-'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-white/40 p-6 space-y-4">
              <h3 className="text-base font-bold text-gray-900">Subscription & KYC</h3>
              <div className="divide-y divide-gray-100 text-xs text-gray-700">
                <div className="py-2.5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-500" />
                    <span className="font-medium text-gray-500">Current Plan</span>
                  </div>
                  <span className={`font-bold px-2 py-0.5 rounded-full ${subscriptionState === 'tenant' ? 'bg-emerald-100 text-emerald-800' : subscriptionState === 'user' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                    {subscriptionState === 'tenant' ? 'Tenant Sub (R299,99/mo)' : subscriptionState === 'user' ? 'User Sub (R29,99/mo)' : 'None'}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span className="font-medium text-gray-500">ID Document</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {idDocUrl ? (
                      <button
                        type="button"
                        onClick={() => setViewingDoc({ url: idDocUrl, title: `ID Document: ${idDocName || 'Saved Document'}` })}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> View ID ({idDocName ? idDocName.substring(0, 12) + '...' : 'Saved'})
                      </button>
                    ) : (
                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Verified
                      </span>
                    )}
                  </div>
                </div>
                <div className="py-2.5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-500" />
                    <span className="font-medium text-gray-500">Proof of Payment</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {popDocUrl ? (
                      <button
                        type="button"
                        onClick={() => setViewingDoc({ url: popDocUrl, title: `Proof of Payment: ${popDocName || 'Saved Slip'}` })}
                        className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Slip ({popDocName ? popDocName.substring(0, 12) + '...' : 'Saved'})
                      </button>
                    ) : (
                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Approved
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              {isAlreadyRegistered ? (
                <div className="flex-1 min-w-[200px] py-3 px-4 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Subscription Active ({subscriptionState === 'tenant' ? 'Tenant Sub' : 'User Sub'})</span>
                </div>
              ) : (
                <button
                  onClick={handleOpenActivationModal}
                  className="flex-1 min-w-[200px] py-3 bg-white/80 hover:bg-white text-blue-600 border border-blue-200 font-bold rounded-xl text-xs transition-all shadow-sm"
                >
                  Activate Subscription
                </button>
              )}
              <button
                onClick={handleToggleDisableAccount}
                className="py-3 px-4 bg-gray-50/80 hover:bg-gray-100 text-gray-700 border border-gray-200 font-bold rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-1.5"
                title="Disable Account"
              >
                <PowerOff className="w-4 h-4 text-gray-500" /> Disable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Menu Bar (Docked at the bottom, GiGs icon bigger and other icons smaller, no boxes) */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 pt-3 pb-3 safe-p-bottom px-6 shadow-2xl flex items-center justify-around">
        {subscriptionState === 'tenant' ? (
          // Tenant Sub Activated: TenantPortal (smaller), GiGs (BIGGER), Profile (smaller)
          <>
            <button
              onClick={() => setActiveView('tenant-portal')}
              className={`flex flex-col items-center gap-1 group focus:outline-none relative ${activeView === 'tenant-portal' ? 'text-emerald-600 font-bold' : 'text-gray-500 font-medium'}`}
              title="Tenant"
            >
              <div className="relative">
                <Building2 className="w-5 h-5 transition-transform group-hover:scale-110" />
                {(() => {
                  const myCode = getReferralCode(currentEmail);
                  const isMaster = currentEmail === 'timegig2026@gmail.com';
                  const refCount = isMaster 
                    ? registeredUsers.length - 1 
                    : registeredUsers.filter(u => u.referredBy === myCode).length;
                  
                  if (refCount > 0) {
                    return (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                        {refCount > 99 ? '99+' : refCount}
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
              <span className="text-[10px]">Tenant</span>
            </button>

            <button
              onClick={() => setActiveView('gigs')}
              className={`flex flex-col items-center gap-1 group focus:outline-none ${activeView === 'gigs' ? 'text-blue-600 font-bold' : 'text-gray-500 font-medium'}`}
              title="GiGs"
            >
              <Wrench className="w-9 h-9 transition-transform group-hover:scale-110" />
              <span className="text-xs">GiGs</span>
            </button>

            <button
              onClick={() => setActiveView('profile')}
              className={`flex flex-col items-center gap-1 group focus:outline-none ${activeView === 'profile' ? 'text-blue-600 font-bold' : 'text-gray-500 font-medium'}`}
              title="Profile"
            >
              {selfieImage ? (
                <img src={selfieImage} alt="Profile" className="w-6 h-6 rounded-full object-cover transition-transform group-hover:scale-110" />
              ) : (
                <User className="w-5 h-5 transition-transform group-hover:scale-110" />
              )}
              <span className="text-[10px]">Profile</span>
            </button>
          </>
        ) : (subscriptionState === 'user' || isAlreadyRegistered) ? (
          // User Sub Activated or Already Registered Referral/User: Seekers (smaller), GiGs (BIGGER), Profile (smaller)
          <>
            <button
              onClick={() => setActiveView('seekers')}
              className={`flex flex-col items-center gap-1 group focus:outline-none ${activeView === 'seekers' ? 'text-blue-600 font-bold' : 'text-gray-500 font-medium'}`}
              title="Seekers"
            >
              <Users className="w-5 h-5 transition-transform group-hover:scale-110" />
              <span className="text-[10px]">Seekers</span>
            </button>

            <button
              onClick={() => setActiveView('gigs')}
              className={`flex flex-col items-center gap-1 group focus:outline-none ${activeView === 'gigs' ? 'text-blue-600 font-bold' : 'text-gray-500 font-medium'}`}
              title="GiGs"
            >
              <Wrench className="w-9 h-9 transition-transform group-hover:scale-110" />
              <span className="text-xs">GiGs</span>
            </button>

            <button
              onClick={() => setActiveView('profile')}
              className={`flex flex-col items-center gap-1 group focus:outline-none ${activeView === 'profile' ? 'text-blue-600 font-bold' : 'text-gray-500 font-medium'}`}
              title="Profile"
            >
              {selfieImage ? (
                <img src={selfieImage} alt="Profile" className="w-6 h-6 rounded-full object-cover transition-transform group-hover:scale-110" />
              ) : (
                <User className="w-5 h-5 transition-transform group-hover:scale-110" />
              )}
              <span className="text-[10px]">Profile</span>
            </button>
          </>
        ) : (
          // Not Activated / New User: ONLY the Activation feature icon (bigger, no box)
          <div className="flex items-center justify-center w-full">
            <button
              onClick={handleOpenActivationModal}
              className="flex flex-col items-center gap-1 group focus:outline-none text-blue-600 font-bold"
              title="Activation"
            >
              <Zap className="w-9 h-9 transition-transform group-hover:scale-110" />
              <span className="text-xs">Activation</span>
            </button>
          </div>
        )}
      </div>

      {/* Activation Modal */}
      {showActivationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Account Activation & KYC</h2>
                  <p className="text-xs text-gray-500">
                    {isAlreadyRegistered ? 'Status: Active Registration' : (
                      <>
                        {activationStep === 'plan' && 'Step 1 of 2: Choose your subscription'}
                        {activationStep === 'kyc' && 'Step 2 of 2: Verification & Documents (Required)'}
                        {activationStep === 'loading' && 'Processing Activation...'}
                        {activationStep === 'success' && 'Congratulations!'}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activationStep !== 'loading' && (
                  <button
                    onClick={() => setActiveHelp(helpContent.activation)}
                    className="p-2 text-blue-600 hover:text-blue-700 rounded-full hover:bg-blue-50 transition-colors"
                    title="Activation Help"
                  >
                    <HelpCircle className="w-6 h-6" />
                  </button>
                )}
                {activationStep !== 'loading' && (
                  <button
                    onClick={() => {
                      setShowActivationModal(false);
                      stopCamera();
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[80vh] overflow-y-auto">
              {isAlreadyRegistered ? (
                <div className="py-8 flex flex-col items-center text-center space-y-4 animate-in fade-in duration-300">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-lg">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-extrabold text-gray-900">Subscription Already Active</h3>
                    <p className="text-xs font-semibold text-emerald-600">
                      You are already registered ({subscriptionState === 'tenant' ? 'Tenant Sub' : 'User Sub'}).
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
                    Registered referrals and members already have active platform privileges and cannot activate a subscription again.
                  </p>
                  <button
                    onClick={() => {
                      setShowActivationModal(false);
                      stopCamera();
                    }}
                    className="mt-3 px-6 py-2.5 bg-gray-900 hover:bg-black text-white font-bold rounded-xl text-xs shadow-md transition-all"
                  >
                    Close Window
                  </button>
                </div>
              ) : (
                <>
                  {activationStep === 'plan' && (() => {
                // Determine fees based on referrer's settings
                const referrer = registeredUsers.find(u => getReferralCode(u.email) === referralCode);
                const referrerEmail = referrer ? referrer.email : 'timegig2026@gmail.com';
                
                const activeUserFee = localStorage.getItem(`user_fee_${referrerEmail}`) || (referrerEmail === 'timegig2026@gmail.com' ? '29.99' : '29.99');
                const activeTenantFee = localStorage.getItem(`tenant_fee_${referrerEmail}`) || (referrerEmail === 'timegig2026@gmail.com' ? '299.99' : '299.99');

                // Referrer Bank Details
                const refBankName = localStorage.getItem(`bank_name_${referrerEmail}`) || (referrerEmail === 'timegig2026@gmail.com' ? 'TimeGiG Central Bank' : 'Contact Referrer');
                const refAccHolder = localStorage.getItem(`acc_holder_${referrerEmail}`) || (referrerEmail === 'timegig2026@gmail.com' ? 'TimeGiG Pty Ltd' : 'Not Provided');
                const refAccNum = localStorage.getItem(`acc_num_${referrerEmail}`) || (referrerEmail === 'timegig2026@gmail.com' ? '9876543210' : 'Not Provided');
                const refBranch = localStorage.getItem(`branch_code_${referrerEmail}`) || (referrerEmail === 'timegig2026@gmail.com' ? '250655' : 'Not Provided');

                return (
                  <div className="space-y-6">
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                      <p className="text-[11px] text-blue-700 leading-tight">
                        You were referred by <span className="font-bold">{referrerEmail}</span>. The subscription fees and payment details below are set by your referring tenant.
                      </p>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3 shadow-sm">
                      <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase">
                        <CreditCard className="w-4 h-4" /> Payment Information
                      </div>
                      <p className="text-[11px] text-emerald-800 leading-tight">
                        Please transfer the monthly subscription fee to the following bank account before proceeding to upload your Proof of Payment:
                      </p>
                      <div className="grid grid-cols-2 gap-y-2 text-[11px]">
                        <div className="text-gray-500 font-medium">Bank Name:</div>
                        <div className="font-bold text-gray-900">{refBankName}</div>
                        <div className="text-gray-500 font-medium">Account Holder:</div>
                        <div className="font-bold text-gray-900">{refAccHolder}</div>
                        <div className="text-gray-500 font-medium">Account Number:</div>
                        <div className="font-bold text-gray-900">{refAccNum}</div>
                        <div className="text-gray-500 font-medium">Branch Code:</div>
                        <div className="font-bold text-gray-900">{refBranch}</div>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600">
                      Please select one subscription plan below to proceed with account activation:
                    </p>

                    <div className="grid grid-cols-1 gap-4">
                      {/* User Sub Box */}
                      <div
                        onClick={() => setSelectedPlan('user')}
                        className={`cursor-pointer rounded-2xl border-2 p-5 transition-all flex items-start gap-4 ${
                          selectedPlan === 'user'
                            ? 'border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-500/20'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name="subscription"
                          checked={selectedPlan === 'user'}
                          onChange={() => setSelectedPlan('user')}
                          className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-gray-900 text-base">User Sub</h3>
                            <span className="text-blue-600 font-extrabold text-base">R{activeUserFee}<span className="text-xs text-gray-500 font-normal">/mo</span></span>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            Full access to use the app and all interactive map navigation features.
                          </p>
                        </div>
                      </div>

                      {/* Tenant Sub Box */}
                      <div
                        onClick={() => setSelectedPlan('tenant')}
                        className={`cursor-pointer rounded-2xl border-2 p-5 transition-all flex items-start gap-4 ${
                          selectedPlan === 'tenant'
                            ? 'border-emerald-600 bg-emerald-50/50 shadow-md ring-2 ring-emerald-500/20'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name="subscription"
                          checked={selectedPlan === 'tenant'}
                          onChange={() => setSelectedPlan('tenant')}
                          className="mt-1 w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-gray-900 text-base">Tenant Sub</h3>
                            <span className="text-emerald-600 font-extrabold text-base">R{activeTenantFee}<span className="text-xs text-gray-500 font-normal">/mo</span></span>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            Become a tenant and earn a passive monthly income from user subscriptions. Keeps your tenant account active.
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setActivationStep('kyc')}
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
                    >
                      <span>Proceed to Verification</span>
                    </button>
                  </div>
                );
              })()}

              {activationStep === 'kyc' && (
                <form onSubmit={handleFinalSubmit} className="space-y-6">
                  {/* Selfie Upload / Capture */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center justify-between">
                      <span>1. Face Selfie Picture <span className="text-red-500">*</span></span>
                      {selfieImage && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Attached</span>}
                    </label>
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl p-4 bg-gray-50">
                      {selfieImage ? (
                        <div className="relative w-32 h-32 rounded-xl overflow-hidden shadow-md group">
                          <img 
                            src={selfieImage} 
                            alt="Selfie" 
                            onClick={() => setViewingDoc({ url: selfieImage, title: 'Your Selfie Preview' })}
                            className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform" 
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <Eye className="w-6 h-6 text-white" />
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelfieImage(null)}
                            className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full text-xs"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : isCameraActive ? (
                        <div className="relative w-full max-w-xs rounded-xl overflow-hidden bg-black">
                          <video ref={videoRef} className="w-full h-48 object-cover" autoPlay playsInline />
                          <button
                            type="button"
                            onClick={capturePhoto}
                            className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-2 bg-blue-600 text-white rounded-full font-semibold text-xs shadow-lg flex items-center gap-1.5"
                          >
                            <Camera className="w-4 h-4" /> Capture Photo
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                          <button
                            type="button"
                            onClick={startCamera}
                            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
                          >
                            <Camera className="w-4 h-4" /> Request Camera & Capture
                          </button>
                          <label className="px-4 py-2.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all">
                            <Upload className="w-4 h-4" /> Upload Selfie File
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  const reader = new FileReader();
                                  reader.onload = (ev) => setSelfieImage(ev.target?.result as string);
                                  reader.readAsDataURL(e.target.files[0]);
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ID Document Upload */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center justify-between">
                      <span>2. ID Document (Required) <span className="text-red-500">*</span></span>
                      {(idDocFile || idDocUrl) && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {idDocFile ? 'Attached' : 'Remembered'}</span>}
                    </label>
                    <label className={`flex items-center justify-between border-2 border-dashed rounded-2xl p-4 transition-all cursor-pointer ${(idDocFile || idDocUrl) ? 'border-emerald-500 bg-emerald-50/30' : 'border-gray-200 bg-gray-50 hover:bg-gray-100/50'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${(idDocFile || idDocUrl) ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                          <Upload className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">
                            {idDocFile ? idDocFile.name : (idDocName || 'Upload ID card or passport (Required)')}
                          </p>
                          <p className="text-[10px] text-gray-500">PDF, PNG, JPG up to 10MB</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {idDocUrl && !idDocFile && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setViewingDoc({ url: idDocUrl, title: `ID Document: ${idDocName || 'Saved'}` });
                            }}
                            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <span className={`text-xs font-semibold px-3 py-1 rounded-lg ${(idDocFile || idDocUrl) ? 'text-emerald-700 bg-emerald-100' : 'text-blue-600 bg-blue-50'}`}>
                          {(idDocFile || idDocUrl) ? 'Change' : 'Browse'}
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        required
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            setIdDocFile(file);
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const url = ev.target?.result as string;
                              setIdDocUrl(url);
                              setIdDocName(file.name);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Proof of Payment Upload */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center justify-between">
                      <span>3. Proof of Payment Document (Required) <span className="text-red-500">*</span></span>
                      {(popFile || popDocUrl) && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {popFile ? 'Attached' : 'Remembered'}</span>}
                    </label>
                    <label className={`flex items-center justify-between border-2 border-dashed rounded-2xl p-4 transition-all cursor-pointer ${(popFile || popDocUrl) ? 'border-emerald-500 bg-emerald-50/30' : 'border-gray-200 bg-gray-50 hover:bg-gray-100/50'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${(popFile || popDocUrl) ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-100 text-emerald-600'}`}>
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">
                            {popFile ? popFile.name : (popDocName || 'Upload proof of payment slip (Required)')}
                          </p>
                          <p className="text-[10px] text-gray-500">PDF, PNG, JPG up to 10MB</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {popDocUrl && !popFile && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setViewingDoc({ url: popDocUrl, title: `Proof of Payment: ${popDocName || 'Saved'}` });
                            }}
                            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <span className={`text-xs font-semibold px-3 py-1 rounded-lg ${(popFile || popDocUrl) ? 'text-emerald-700 bg-emerald-100' : 'text-emerald-600 bg-emerald-50'}`}>
                          {(popFile || popDocUrl) ? 'Change' : 'Browse'}
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        required
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            setPopFile(file);
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const url = ev.target?.result as string;
                              setPopDocUrl(url);
                              setPopDocName(file.name);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setActivationStep('plan')}
                      className="w-1/3 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs transition-all"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="w-2/3 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
                    >
                      <span>Submit Verification</span>
                    </button>
                  </div>
                </form>
              )}

              {activationStep === 'loading' && (
                <div className="py-12 flex flex-col items-center text-center space-y-6">
                  <div className="relative flex items-center justify-center">
                    <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <div className="absolute">
                      <Zap className="w-8 h-8 text-blue-600 animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-gray-900">Processing Your Activation...</h3>
                    <p className="text-xs text-gray-500">Verifying your documents and securing your subscription...</p>
                  </div>
                </div>
              )}

              {activationStep === 'success' && (
                <div className="py-8 flex flex-col items-center text-center space-y-4 animate-in fade-in duration-300">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-lg">
                    <Award className="w-10 h-10 animate-bounce" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-extrabold text-gray-900">Congratulations!</h3>
                    <p className="text-sm font-semibold text-emerald-600">
                      Your {selectedPlan === 'tenant' ? 'Tenant Sub (R299,99/mo)' : 'User Sub (R29,99/mo)'} is successfully activated!
                    </p>
                  </div>
                  <p className="text-xs text-gray-600 max-w-xs">
                    {selectedPlan === 'tenant'
                      ? 'You are now a registered tenant. Your account is active to earn passive monthly income from user subscriptions.'
                      : 'Your user subscription is now active. Enjoy full access to Seekers, GiGs, and Profile features!'}
                  </p>
                  <button
                    onClick={() => {
                      setShowActivationModal(false);
                      setActivationStep('plan');
                      setActiveView('profile');
                    }}
                    className="mt-4 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs shadow-lg shadow-blue-500/25 transition-all"
                  >
                    View Profile
                  </button>
                </div>
              )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Full Screen Document Viewer */}
      {viewingDoc && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col p-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-white mb-4">
            <h3 className="text-lg font-bold truncate max-w-[80%]">{viewingDoc.title}</h3>
            <button
              onClick={() => setViewingDoc(null)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            <img
              src={viewingDoc.url}
              alt="Document Preview"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
          </div>
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => setViewingDoc(null)}
              className="px-8 py-3 bg-white text-black font-bold rounded-xl shadow-lg hover:bg-gray-100 transition-colors"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}


      {/* Help Modal Overlay */}
      {activeHelp && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-blue-600 text-white">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5" />
                <h3 className="font-bold text-lg">{activeHelp.title}</h3>
              </div>
              <button 
                onClick={() => setActiveHelp(null)}
                className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
              {activeHelp.sections.map((section, idx) => (
                <div key={idx} className="space-y-2">
                  <h4 className="text-sm font-extrabold text-blue-600 uppercase tracking-wider">{section.title}</h4>
                  <p className="text-sm text-gray-600 leading-relaxed font-medium">{section.content}</p>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setActiveHelp(null)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md transition-all"
              >
                Got it, thanks!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Splash Screen Overlay */}
      {showSplash && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center animate-in fade-in duration-500">
          {/* Map background visible with blur */}
          <div className="absolute inset-0 backdrop-blur-xl bg-white/10" />
          <div className="relative z-10 text-blue-600 text-7xl font-black tracking-tighter drop-shadow-sm animate-pulse flex flex-col items-center">
            <span>TimeGiG</span>
            <div className="h-1 w-24 bg-blue-600 rounded-full mt-2 opacity-20" />
          </div>
        </div>
      )}
      {viewingSeekerProfile && (
        <div className="fixed inset-0 z-[110] bg-white/90 backdrop-blur-sm p-6 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-gray-100 relative">
            <button onClick={() => setViewingSeekerProfile(null)} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200">
              <X className="w-5 h-5"/>
            </button>
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-3xl shadow-md">
                {viewingSeekerProfile.name.split(' ').map((n: string) => n[0]).join('')}
              </div>
              <h2 className="text-xl font-bold mt-4 text-gray-900">{viewingSeekerProfile.name}</h2>
              <p className="text-gray-500 text-sm">{viewingSeekerProfile.role}</p>
              <p className="text-gray-400 text-xs mt-1">{viewingSeekerProfile.location}</p>
              <div className="mt-4 px-4 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-xl">
                ★ {viewingSeekerProfile.rating}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Create Gig Modal (Full Screen) */}
      {showCreateGigModal && (
        <div className="fixed inset-0 z-[120] bg-white animate-in slide-in-from-bottom duration-300 flex flex-col">
          <div className="safe-p-top px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
            <button
              onClick={() => setShowCreateGigModal(false)}
              className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"
            >
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">Post a New Gig</h2>
            <div className="w-10" /> {/* Spacer */}
          </div>

          <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 bg-gray-50/30 relative">
            {/* 2-second Circle Loading Overlay */}
            {isCreatingGig && (
              <div className="fixed inset-0 z-50 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
                <div className="relative flex items-center justify-center mb-6">
                  <div className="w-24 h-24 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                  <div className="absolute">
                    <MapPin className="w-10 h-10 text-blue-600 animate-pulse" />
                  </div>
                </div>
                <h3 className="text-xl font-extrabold text-gray-900">Publishing Gig Post...</h3>
                <p className="text-xs text-gray-500 mt-2 max-w-xs font-medium">
                  Broadcasting live onto the map for all users and seekers to see!
                </p>
                <div className="mt-4 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-wider border border-blue-100">
                  Syncing Live Coordinates
                </div>
              </div>
            )}
            <div className="max-w-2xl mx-auto">
              <form onSubmit={handleCreateGigSubmit} className="space-y-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Gig Title</label>
                    <input
                      type="text"
                      required
                      value={newGigTitle}
                      onChange={(e) => setNewGigTitle(e.target.value)}
                      placeholder="e.g. Garden Maintenance Needed"
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Gig Details</label>
                    <textarea
                      required
                      rows={4}
                      value={newGigDetails}
                      onChange={(e) => setNewGigDetails(e.target.value)}
                      placeholder="Describe the task and requirements..."
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all resize-none"
                    ></textarea>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <div className="flex items-center justify-between mb-1.5 ml-1">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Time & Date</label>
                        <button
                          type="button"
                          onClick={() => setNewGigIsImmediate(!newGigIsImmediate)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${newGigIsImmediate ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}
                        >
                          {newGigIsImmediate ? 'IMMEDIATE ACTIVE' : 'MARK IMMEDIATE'}
                        </button>
                      </div>
                      {!newGigIsImmediate ? (
                        <div className="relative flex items-center">
                          <Calendar className="absolute left-4 w-5 h-5 text-gray-400" />
                          <input
                            type="datetime-local"
                            required
                            value={newGigDate}
                            onChange={(e) => setNewGigDate(e.target.value)}
                            className="w-full pl-12 pr-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 px-5 py-4 bg-orange-50 border border-orange-100 rounded-2xl text-orange-700">
                          <Zap className="w-5 h-5 fill-current" />
                          <span className="text-sm font-bold uppercase tracking-tight">Immediate Assistance Requested</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Budget (ZAR)</label>
                      <div className="relative flex items-center">
                        <DollarSign className="absolute left-4 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          required
                          value={newGigBudget}
                          onChange={(e) => setNewGigBudget(e.target.value)}
                          placeholder="e.g. R500"
                          className="w-full pl-12 pr-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5 ml-1">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Location</label>
                      <button
                        type="button"
                        onClick={handleAutoFillGigLocation}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <Locate className="w-3 h-3" /> Auto-fill Current
                      </button>
                    </div>
                    <div className="relative flex items-center">
                      <MapPin className="absolute left-4 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        required
                        value={newGigLocation}
                        onChange={(e) => setNewGigLocation(e.target.value)}
                        placeholder="Street, City, Province"
                        className="w-full pl-12 pr-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Experience Needed</label>
                    <div className="relative flex items-center">
                      <Award className="absolute left-4 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        required
                        value={newGigExperience}
                        onChange={(e) => setNewGigExperience(e.target.value)}
                        placeholder="e.g. 2+ years plumbing experience"
                        className="w-full pl-12 pr-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isCreatingGig}
                    className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-3xl text-sm shadow-2xl shadow-blue-500/30 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isCreatingGig ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>CREATING POST...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        <span>CREATE GIG POST</span>
                      </>
                    )}
                  </button>
                  <p className="text-center text-[10px] text-gray-400 font-bold uppercase mt-4 tracking-tighter">Your gig will be live on the map instantly</p>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
  );
}
