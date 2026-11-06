import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Building2,
  MapPin, 
  Wifi, 
  Snowflake, 
  Zap, 
  Shirt, 
  Rocket, 
  CheckCircle2, 
  Check, 
  Bot, 
  CreditCard, 
  ExternalLink, 
  Loader2,
  Image as ImageIcon,
  Trash2,
  Plus,
  RefreshCw,
  Camera,
  Layers,
  Sparkles,
  Info,
  LockKeyhole,
  ArrowUpRight,
  Pencil,
  Globe2,
  ArrowRight,
} from 'lucide-react';
import Toast from '../components/Toast';
import type { ToastMessage } from '../components/Toast';
import Modal from '../components/Modal';
import { PageHeader, ScrollableTabs } from '../components/responsive/ResponsivePrimitives';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updateCurrentUser } from '../features/auth/authSlice';
import {
  useGetHostelByIdQuery,
  useCreateHostelMutation,
  useUpdateHostelMutation,
  usePublishHostelMutation,
  useGetChatbotInfoQuery,
  useUpdateChatbotInfoMutation,
  useGetStripeStatusQuery,
  useLazyGetStripeOnboardLinkQuery,
} from '../features/api/hostelApi';
import {
  useUploadImageMutation,
  useUploadImagesMutation,
} from '../features/api/uploadApi';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import type { ChatbotInfo } from '../types/api';
import PhoneInputWithCountry from '../components/PhoneInputWithCountry';
import TimePicker from '../components/TimePicker';
import {
  type CountryInfo,
  DEFAULT_COUNTRY,
  COUNTRIES,
  parseExistingPhone,
  validateAndFormatPhone,
  formatPhoneDisplay,
} from '../utils/phoneUtils';

type TabKey = 'property' | 'images' | 'amenities' | 'chatbot' | 'payouts' | 'review';
type OptionalTabKey = 'images' | 'amenities' | 'chatbot' | 'payouts';
type SetupStatus = 'Configured' | 'Pending' | 'Unsaved' | 'Checking' | 'Unavailable' | 'Published';
const SETUP_ORDER: TabKey[] = ['property', 'images', 'amenities', 'chatbot', 'payouts', 'review'];

interface TabItem {
  id: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

export default function HostelRegistrationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const hostelId = user?.hostelId ?? '';

  const requestedTab = (searchParams.get('tab') as TabKey) || 'property';
  const initialTab = !user?.hostelId && ['chatbot', 'payouts'].includes(requestedTab) ? 'property' : requestedTab;
  // Active Tab State (defaults to query param if valid, or 'property')
  const [activeTab, setActiveTab] = useState<TabKey>(
    ['property', 'images', 'amenities', 'chatbot', 'payouts', 'review'].includes(initialTab) ? initialTab : 'property'
  );
  const appliedTabParam = useRef(searchParams.get('tab'));

  useEffect(() => {
    const tabParam = searchParams.get('tab') as TabKey | null;
    // Creating a draft must not reapply the old URL tab over the next setup step.
    if (appliedTabParam.current === tabParam) return;
    appliedTabParam.current = tabParam;
    if (tabParam && ['property', 'images', 'amenities', 'chatbot', 'payouts', 'review'].includes(tabParam) && (user?.hostelId || !['chatbot', 'payouts'].includes(tabParam))) {
      setActiveTab(tabParam);
    } else if (!user?.hostelId && ['chatbot', 'payouts'].includes(tabParam || '')) {
      setActiveTab('property');
    }
  }, [searchParams, user?.hostelId]);

  const {
    data: existingHostel,
  } = useGetHostelByIdQuery(hostelId, { skip: !hostelId, refetchOnMountOrArgChange: true });

  const {
    data: chatbotInfo,
    isFetching: isCheckingChatbot,
    isError: chatbotCheckFailed,
    refetch: refetchChatbotInfo,
  } = useGetChatbotInfoQuery(hostelId, { skip: !hostelId });

  const {
    data: stripeStatus,
    isFetching: isCheckingStripe,
    isError: stripeCheckFailed,
    refetch: refetchStripeStatus,
  } = useGetStripeStatusQuery(hostelId, { skip: !hostelId, refetchOnMountOrArgChange: true });

  useEffect(() => {
    if (activeTab === 'payouts' && hostelId) {
      refetchStripeStatus();
    }
  }, [activeTab, hostelId, refetchStripeStatus]);

  const [createHostelMutation, { isLoading: isCreating }] = useCreateHostelMutation();
  const [publishHostel, { isLoading: isPublishing }] = usePublishHostelMutation();
  const [updateHostelMutation, { isLoading: isUpdating }] = useUpdateHostelMutation();
  const [updateChatbotMutation, { isLoading: isSavingChatbot }] = useUpdateChatbotInfoMutation();
  const [triggerStripeOnboard, { isFetching: isFetchingStripe }] = useLazyGetStripeOnboardLinkQuery();

  // ImageKit Upload Mutations
  const [uploadImageMutation, { isLoading: isUploadingBanner }] = useUploadImageMutation();
  const [uploadImagesMutation, { isLoading: isUploadingGallery }] = useUploadImagesMutation();

  // Primary Property Form State
  const [hostelName, setHostelName] = useState('');
  const [location, setLocation] = useState('');
  const [priceTier, setPriceTier] = useState(0);
  const [amenities, setAmenities] = useState({
    wifi: false,
    ac: false,
    generator: false,
    laundry: false,
  });

  // Dedicated Image State (ImageKit URLs)
  // bannerImage is strictly separated from gallery images[]
  const [bannerImage, setBannerImage] = useState<string>('');
  const [galleryImages, setGalleryImages] = useState<string[]>([]);

  // Hidden File Input References
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Property Information (timings, rules, contact, landmarks — single source of truth)
  const [gateOpenTime, setGateOpenTime] = useState('');
  const [gateCloseTime, setGateCloseTime] = useState('');
  const [receptionContact, setReceptionContact] = useState('');
  const [receptionCountry, setReceptionCountry] = useState<CountryInfo>(DEFAULT_COUNTRY);
  const [receptionPhoneError, setReceptionPhoneError] = useState<string | null>(null);
  const [nearbyLandmarks, setNearbyLandmarks] = useState('');
  const [houseRulesText, setHouseRulesText] = useState('');

  // Chatbot-Specific Knowledge (private resident WiFi, emergency contact, and specialized notes)
  const [wifiPassword, setWifiPassword] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [emergencyCountry, setEmergencyCountry] = useState<CountryInfo>(DEFAULT_COUNTRY);
  const [emergencyPhoneError, setEmergencyPhoneError] = useState<string | null>(null);
  const [additionalInfo, setAdditionalInfo] = useState('');

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isAdvancingSetup, setIsAdvancingSetup] = useState(false);
  const setupOperation = useRef(false);
  const [skipSetupTab, setSkipSetupTab] = useState<OptionalTabKey | null>(null);

  const isDraft = !hostelId || existingHostel?.publicationStatus !== 'Published';
  const propertySnapshot = JSON.stringify([hostelName, location, priceTier, amenities, bannerImage, galleryImages, gateOpenTime, gateCloseTime, receptionContact, receptionCountry.code, nearbyLandmarks, houseRulesText]);
  const chatbotSnapshot = JSON.stringify([wifiPassword, emergencyContact, emergencyCountry.code, additionalInfo]);
  const [savedProperty, setSavedProperty] = useState(propertySnapshot);
  const [savedChatbot, setSavedChatbot] = useState(chatbotSnapshot);
  const hydratedProperty = useRef<string | null>(null);
  const hydratedChatbot = useRef<string | null>(null);
  const propertyHydrating = useRef(false);
  useLayoutEffect(() => {
    if (propertyHydrating.current) { propertyHydrating.current = false; setSavedProperty(propertySnapshot); }
  });
  const propertyDirty = propertySnapshot !== savedProperty;
  const chatbotDirty = chatbotSnapshot !== savedChatbot;
  const savedPropertyValues = JSON.parse(savedProperty) as [string, string, number, typeof amenities, string, string[]];
  const savedChatbotValues = JSON.parse(savedChatbot) as [string, string, CountryInfo['code'], string];
  const optionalDirty: Record<OptionalTabKey, boolean> = {
    images: bannerImage !== savedPropertyValues[4] || JSON.stringify(galleryImages) !== JSON.stringify(savedPropertyValues[5]),
    amenities: JSON.stringify(amenities) !== JSON.stringify(savedPropertyValues[3]),
    chatbot: chatbotDirty,
    payouts: false,
  };
  const setupBusy = isAdvancingSetup || isCreating || isUpdating || isSavingChatbot || isPublishing || isUploadingBanner || isUploadingGallery || isFetchingStripe;
  const setupStatus: Record<TabKey, SetupStatus> = {
    property: propertyDirty ? 'Unsaved' : hostelId && savedPropertyValues[0].trim() && savedPropertyValues[1].trim() && Number.isFinite(savedPropertyValues[2]) && savedPropertyValues[2] >= 0 ? 'Configured' : 'Pending',
    images: optionalDirty.images ? 'Unsaved' : hostelId && (savedPropertyValues[4] || savedPropertyValues[5].length) ? 'Configured' : 'Pending',
    amenities: optionalDirty.amenities ? 'Unsaved' : hostelId && Object.values(savedPropertyValues[3]).some(Boolean) ? 'Configured' : 'Pending',
    chatbot: chatbotDirty ? 'Unsaved' : !hostelId ? 'Pending' : chatbotCheckFailed ? 'Unavailable' : isCheckingChatbot || !chatbotInfo ? 'Checking' : [savedChatbotValues[0], savedChatbotValues[1], savedChatbotValues[3]].some((value) => value.trim()) ? 'Configured' : 'Pending',
    payouts: !hostelId ? 'Pending' : stripeCheckFailed ? 'Unavailable' : isCheckingStripe || !stripeStatus ? 'Checking' : stripeStatus.isConnected ? 'Configured' : 'Pending',
    review: isDraft ? 'Pending' : 'Published',
  };
  const { leaveDialog, allowNavigation } = useUnsavedChanges(propertyDirty || chatbotDirty);

  // Sync existing hostel details into form
  useEffect(() => {
    if (existingHostel && hydratedProperty.current !== existingHostel._id) {
      hydratedProperty.current = existingHostel._id;
      propertyHydrating.current = true;
      setHostelName(existingHostel.name);
      setLocation(existingHostel.location);
      if (existingHostel.priceTier !== undefined) setPriceTier(existingHostel.priceTier);
      if (existingHostel.facilities) {
        setAmenities({
          wifi: existingHostel.facilities.includes('High-Speed Wi-Fi'),
          ac: existingHostel.facilities.includes('Air Conditioning'),
          generator: existingHostel.facilities.includes('Power Backup'),
          laundry: existingHostel.facilities.includes('Laundry Facility'),
        });
      }

      // Sync propertyInfo (with fallback to legacy chatbotInfo if not yet set)
      if (existingHostel.propertyInfo) {
        if (existingHostel.propertyInfo.gateOpenTime) setGateOpenTime(existingHostel.propertyInfo.gateOpenTime);
        if (existingHostel.propertyInfo.gateCloseTime) setGateCloseTime(existingHostel.propertyInfo.gateCloseTime);
        if (existingHostel.propertyInfo.receptionContact) {
          const parsed = parseExistingPhone(existingHostel.propertyInfo.receptionContact);
          setReceptionCountry(parsed.country);
          setReceptionContact(parsed.nationalNumber);
        }
        if (existingHostel.propertyInfo.nearbyLandmarks) setNearbyLandmarks(existingHostel.propertyInfo.nearbyLandmarks);
        if (existingHostel.propertyInfo.houseRules && existingHostel.propertyInfo.houseRules.length > 0) {
          setHouseRulesText(existingHostel.propertyInfo.houseRules.join('\n'));
        }
      } else if (existingHostel.chatbotInfo) {
        if (existingHostel.chatbotInfo.contactNumber) {
          const parsed = parseExistingPhone(existingHostel.chatbotInfo.contactNumber);
          setReceptionCountry(parsed.country);
          setReceptionContact(parsed.nationalNumber);
        }
        if (existingHostel.chatbotInfo.nearbyLandmarks) setNearbyLandmarks(existingHostel.chatbotInfo.nearbyLandmarks);
        if (existingHostel.chatbotInfo.rules && existingHostel.chatbotInfo.rules.length > 0) {
          setHouseRulesText(existingHostel.chatbotInfo.rules.join('\n'));
        }
      }

      // Ignore legacy local /uploads/ URLs and unconfigured mock endpoints
      const isInvalidUrl = (url: string) =>
        !url || url.includes('/uploads/') || url.includes('ik.imagekit.io/hostelhive/');

      if (existingHostel.bannerImage && !isInvalidUrl(existingHostel.bannerImage)) {
        setBannerImage(existingHostel.bannerImage);
      } else {
        setBannerImage('');
      }

      if (existingHostel.images && Array.isArray(existingHostel.images)) {
        const cleanedGallery = existingHostel.images.filter(
          (img) => img && img.trim() !== '' && !isInvalidUrl(img)
        );
        setGalleryImages(cleanedGallery);
      } else {
        setGalleryImages([]);
      }
    }
  }, [existingHostel]);

  // Hydrate this record once; later query updates must not replace draft input.
  useEffect(() => {
    if (!chatbotInfo || hydratedChatbot.current === hostelId) return;
    hydratedChatbot.current = hostelId;
    const parsed = parseExistingPhone(chatbotInfo.emergencyContact || '');
    const wifi = chatbotInfo.wifiPassword || '';
    const notes = chatbotInfo.additionalInfo || '';
    setWifiPassword(wifi); setEmergencyCountry(parsed.country); setEmergencyContact(parsed.nationalNumber); setAdditionalInfo(notes);
    setSavedChatbot(JSON.stringify([wifi, parsed.nationalNumber, parsed.country.code, notes]));
  }, [chatbotInfo, hostelId]);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToasts((prev) => [...prev, { id: Date.now().toString(), type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const toggleAmenity = (key: keyof typeof amenities) => {
    setAmenities((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getSelectedFacilities = (): string[] => {
    const list: string[] = [];
    if (amenities.wifi) list.push('High-Speed Wi-Fi');
    if (amenities.ac) list.push('Air Conditioning');
    if (amenities.generator) list.push('Power Backup');
    if (amenities.laundry) list.push('Laundry Facility');
    return list;
  };

  // Image Validation: JPG, PNG, WEBP, up to 5MB
  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      return `"${file.name}" is not a supported format. Please upload JPG, PNG, or WEBP images only.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `"${file.name}" exceeds the 5MB file size limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`;
    }
    return null;
  };

  // Banner Upload Handler
  const handleBannerFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      addToast('error', validationError);
      e.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await uploadImageMutation(formData).unwrap();
      if (res?.url) {
        setBannerImage(res.url);
        addToast('success', 'Hostel banner uploaded to ImageKit successfully!');
      }
    } catch (err: any) {
      addToast('error', err?.data?.message || err?.message || 'Failed to upload banner to ImageKit.');
    } finally {
      e.target.value = '';
    }
  };

  const handleRemoveBanner = () => {
    setBannerImage('');
    addToast('info', 'Hostel banner removed.');
  };

  const MAX_GALLERY_IMAGES = 5;

  // Gallery Multiple Files Upload Handler
  const handleGalleryFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);

    const remainingSlots = MAX_GALLERY_IMAGES - galleryImages.length;
    if (remainingSlots <= 0) {
      addToast('error', 'Maximum 5 gallery images allowed.');
      e.target.value = '';
      return;
    }

    if (fileList.length > remainingSlots) {
      addToast(
        'error',
        `You can only add ${remainingSlots} more image${remainingSlots === 1 ? '' : 's'}. Maximum 5 images allowed.`
      );
      e.target.value = '';
      return;
    }

    // Validate all selected files first
    for (const file of fileList) {
      const error = validateFile(file);
      if (error) {
        addToast('error', error);
        e.target.value = '';
        return;
      }
    }

    const formData = new FormData();
    fileList.forEach((file) => {
      formData.append('images', file);
    });

    try {
      const res = await uploadImagesMutation(formData).unwrap();
      if (res?.urls && Array.isArray(res.urls)) {
        setGalleryImages((prev) => [...prev, ...res.urls].slice(0, MAX_GALLERY_IMAGES));
        addToast('success', `Uploaded ${res.urls.length} photo${res.urls.length > 1 ? 's' : ''} to ImageKit successfully!`);
      }
    } catch (err: any) {
      addToast('error', err?.data?.message || err?.message || 'Failed to upload gallery photos to ImageKit.');
    } finally {
      e.target.value = '';
    }
  };

  const handleRemoveGalleryImage = (indexToRemove: number) => {
    setGalleryImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    addToast('info', 'Gallery photo removed.');
  };

  const handlePublish = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!hostelName.trim() || !location.trim()) {
      addToast('error', 'Please fill in mandatory property fields (Name and Location).');
      return;
    }

    if (isUploadingBanner || isUploadingGallery) {
      addToast('error', 'Please wait for images to finish uploading to ImageKit before saving.');
      return;
    }

    const facilities = getSelectedFacilities();

    // Ensure bannerImage is strictly separated from gallery images[]
    const sanitizedGallery = galleryImages.filter((img) => img !== bannerImage);

    if (sanitizedGallery.length > MAX_GALLERY_IMAGES) {
      addToast(
        'error',
        `Maximum ${MAX_GALLERY_IMAGES} gallery images allowed. Please remove ${sanitizedGallery.length - MAX_GALLERY_IMAGES} photo(s) before saving.`
      );
      return;
    }

    // Structure house rules as a clean, trimmed array
    const parsedHouseRules = houseRulesText
      .split('\n')
      .map((r) => r.trim())
      .filter(Boolean);

    let finalReceptionContact: string | undefined = undefined;
    if (receptionContact.trim()) {
      const validation = validateAndFormatPhone(receptionContact, receptionCountry.code);
      if (!validation.isValid || !validation.e164) {
        setReceptionPhoneError(validation.error || 'Please enter a valid phone number.');
        addToast('error', validation.error || 'Please enter a valid reception contact phone number.');
        return;
      }
      finalReceptionContact = validation.e164;
      setReceptionPhoneError(null);
    } else {
      setReceptionPhoneError(null);
    }

    const propertyInfoPayload = {
      gateOpenTime: gateOpenTime.trim() || undefined,
      gateCloseTime: gateCloseTime.trim() || undefined,
      houseRules: parsedHouseRules,
      receptionContact: finalReceptionContact || '',
      nearbyLandmarks: nearbyLandmarks.trim() || undefined,
    };

    try {
      if (hostelId) {
        // Update existing hostel
        await updateHostelMutation({
          id: hostelId,
          data: {
            name: hostelName,
            location,
            priceTier: Number(priceTier),
            facilities,
            bannerImage: bannerImage.trim(),
            images: sanitizedGallery,
            propertyInfo: propertyInfoPayload,
          },
        }).unwrap();

        addToast('success', 'Property details saved.');
      } else {
        // Create new hostel
        const created = await createHostelMutation({
          publicationStatus: 'Draft',
          name: hostelName,
          location,
          priceTier: Number(priceTier),
          facilities,
          bannerImage: bannerImage.trim(),
          images: sanitizedGallery,
          propertyInfo: propertyInfoPayload,
        }).unwrap();

        hydratedProperty.current = created._id;
        dispatch(updateCurrentUser({ hostelId: created._id }));
        setActiveTab('images');
        addToast('success', 'Draft saved. Complete the remaining sections, then review and publish.');
      }
      setSavedProperty(propertySnapshot);
      return true;
    } catch (err: any) {
      addToast('error', err?.data?.message || err?.message || 'Failed to save property.');
    }
  };

  const handleSaveChatbotInfo = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!hostelId) {
      addToast('error', 'Save your property details before adding chatbot knowledge.');
      setActiveTab('property');
      return;
    }

    let finalEmergencyContact: string | undefined;
    if (emergencyContact.trim()) {
      const validation = validateAndFormatPhone(emergencyContact, emergencyCountry.code);
      if (!validation.isValid || !validation.e164) {
        setEmergencyPhoneError(validation.error || 'Enter a valid emergency contact number.');
        addToast('error', validation.error || 'Enter a valid emergency contact number.');
        return;
      }
      finalEmergencyContact = validation.e164;
      setEmergencyPhoneError(null);
    } else {
      setEmergencyPhoneError(null);
    }

    const payload: Partial<ChatbotInfo> = {
      wifiPassword: wifiPassword.trim(),
      emergencyContact: finalEmergencyContact || '',
      additionalInfo: additionalInfo.trim(),
    };

    try {
      await updateChatbotMutation({ hostelId, data: payload }).unwrap();
      setSavedChatbot(chatbotSnapshot);
      addToast('success', 'AI chatbot knowledge updated.');
      return true;
    } catch (err: any) {
      addToast('error', err?.data?.message || err?.message || 'Could not update chatbot knowledge.');
    }
  };

  const handleFinishSetup = async () => {
    if (!hostelId || setupOperation.current || setupBusy) return;
    if (chatbotDirty && (isCheckingChatbot || chatbotCheckFailed)) {
      addToast('info', 'Retry loading chatbot knowledge, or choose Set up later before publishing.');
      setActiveTab('chatbot');
      return;
    }
    setupOperation.current = true;
    setIsAdvancingSetup(true);
    try {
      if (!await handlePublish()) return;
      // Optional chatbot knowledge must not require a successful empty save to publish.
      if (chatbotDirty && !await handleSaveChatbotInfo()) return;
      await publishHostel(hostelId).unwrap();
      setShowSuccessModal(true);
    } catch (error: any) { addToast('error', error?.data?.message || 'Unable to publish your listing.'); }
    finally { setupOperation.current = false; setIsAdvancingSetup(false); }
  };

  const handleAdvanceSetup = async (step: TabKey) => {
    if (setupOperation.current || setupBusy || step === 'review') return;
    if (step === 'chatbot' && chatbotDirty && (isCheckingChatbot || chatbotCheckFailed)) {
      addToast('info', 'Wait for chatbot knowledge to load, retry, or choose Set up later.');
      return;
    }
    setupOperation.current = true;
    setIsAdvancingSetup(true);
    try {
      const saved = step === 'payouts'
        ? true
        : step === 'chatbot'
          ? !chatbotDirty || await handleSaveChatbotInfo()
          : await handlePublish();
      if (saved) setActiveTab(SETUP_ORDER[SETUP_ORDER.indexOf(step) + 1]);
    } finally {
      setupOperation.current = false;
      setIsAdvancingSetup(false);
    }
  };

  const skipOptionalStep = (step: OptionalTabKey) => {
    // Keep saved information; discard only this optional section's unsaved draft.
    if (step === 'images') { setBannerImage(savedPropertyValues[4]); setGalleryImages(savedPropertyValues[5]); }
    if (step === 'amenities') setAmenities(savedPropertyValues[3]);
    if (step === 'chatbot') {
      setWifiPassword(savedChatbotValues[0]);
      setEmergencyContact(savedChatbotValues[1]);
      setEmergencyCountry(COUNTRIES.find((country) => country.code === savedChatbotValues[2]) || DEFAULT_COUNTRY);
      setAdditionalInfo(savedChatbotValues[3]);
      setEmergencyPhoneError(null);
    }
    const next = SETUP_ORDER[SETUP_ORDER.indexOf(step) + 1];
    setSkipSetupTab(null);
    if (!hostelId && ['chatbot', 'payouts'].includes(next)) {
      setActiveTab('property');
      addToast('info', 'Save your property draft to continue to chatbot and payment setup.');
    } else setActiveTab(next);
  };

  const requestSkipStep = (step: OptionalTabKey) => {
    if (setupBusy) return;
    if (optionalDirty[step]) setSkipSetupTab(step);
    else skipOptionalStep(step);
  };

  const skipLabel = (step: OptionalTabKey) => setupStatus[step] === 'Configured'
    ? 'Continue without changes'
    : ['chatbot', 'payouts'].includes(step) ? 'Set up later' : 'Skip for now';

  const handleConnectStripe = async () => {
    if (propertyDirty || chatbotDirty) { addToast('info', 'Save your changes before opening Stripe setup.'); return; }
    if (!hostelId) {
      addToast('error', 'Save your property details before setting up payouts.');
      setActiveTab('property');
      return;
    }

    try {
      const result = await triggerStripeOnboard(hostelId).unwrap();
      if (result?.url) window.location.href = result.url;
    } catch (err: any) {
      addToast('error', err?.data?.message || err?.message || 'Could not open Stripe onboarding.');
    }
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const availableTabs: TabKey[] = hostelId
      ? ['property', 'images', 'amenities', 'chatbot', 'payouts', 'review']
      : ['property', 'images', 'amenities', 'review'];
    const currentIndex = availableTabs.indexOf(activeTab);
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (currentIndex + direction + availableTabs.length) % availableTabs.length;
      setActiveTab(availableTabs[nextIndex]);
      document.getElementById(`tab-btn-${availableTabs[nextIndex]}`)?.focus();
    }
  };

  const tabsConfig: TabItem[] = [
    { id: 'property', label: 'Property Details', icon: Building2 },
    { id: 'images', label: 'Hostel Images', icon: ImageIcon, badge: (bannerImage ? 1 : 0) + galleryImages.length || undefined },
    { id: 'amenities', label: 'Amenities', icon: Sparkles, badge: getSelectedFacilities().length || undefined },
    { id: 'chatbot', label: 'AI Chatbot Knowledge', icon: Bot, badge: setupStatus.chatbot },
    { id: 'payouts', label: 'Payout Settings', icon: CreditCard, badge: setupStatus.payouts },
    { id: 'review', label: isDraft ? 'Review & Publish' : 'Listing Status', icon: CheckCircle2 },
  ];

  // Readiness is based on saved configuration, independently of the current step.
  const reviewFacilities = getSelectedFacilities();
  const reviewPropertyReady = Boolean(hostelId && hostelName.trim() && location.trim() && Number.isFinite(priceTier) && priceTier >= 0);
  const reviewHasChanges = propertyDirty || chatbotDirty;
  const reviewChecks = [
    { tab: 'property' as TabKey, label: 'Property details', description: reviewPropertyReady ? 'Name, address and monthly rent added' : 'Save your property name, address and monthly rent', ready: reviewPropertyReady, required: true, icon: Building2 },
    { tab: 'images' as TabKey, label: 'Property photos', description: bannerImage || galleryImages.length ? `${bannerImage ? 'Cover added' : 'No cover'} · ${galleryImages.length} gallery photo${galleryImages.length === 1 ? '' : 's'}` : 'Add photos to help students picture their stay', ready: Boolean(bannerImage || galleryImages.length), required: false, icon: ImageIcon },
    { tab: 'amenities' as TabKey, label: 'Amenities', description: reviewFacilities.length ? `${reviewFacilities.length} facilit${reviewFacilities.length === 1 ? 'y' : 'ies'} selected` : 'Highlight what your property offers', ready: reviewFacilities.length > 0, required: false, icon: Sparkles },
    { tab: 'chatbot' as TabKey, label: 'AI Chatbot', description: setupStatus.chatbot === 'Configured' ? 'Additional resident knowledge saved' : setupStatus.chatbot === 'Unsaved' ? 'Your chatbot edits have not been saved yet' : setupStatus.chatbot === 'Checking' ? 'Checking saved chatbot knowledge' : setupStatus.chatbot === 'Unavailable' ? 'Could not check saved knowledge. Open this section to retry.' : 'Optional resident knowledge pending. Saved property facts are already used.', ready: setupStatus.chatbot === 'Configured', required: false, icon: Bot },
    { tab: 'payouts' as TabKey, label: 'Card payments', description: stripeStatus?.isConnected ? 'Stripe connected and ready for card payments' : stripeStatus ? 'Complete Stripe setup to accept card payments' : 'Check your Stripe connection in Payout Settings', ready: Boolean(stripeStatus?.isConnected), required: false, icon: CreditCard },
  ];
  const pendingSetupTabs = tabsConfig.filter((tab) => ['images', 'amenities', 'chatbot', 'payouts'].includes(tab.id) && setupStatus[tab.id] === 'Pending');

  const setupStepIndex = tabsConfig.findIndex((tab) => tab.id === activeTab);
  const currentSetupTab = tabsConfig[setupStepIndex];
  const SetupStepIcon = currentSetupTab.icon;
  const setupDescriptions: Record<TabKey, string> = {
    property: 'Add your property name, address and monthly rent.',
    images: 'Give students a first look with a cover and gallery photos.',
    amenities: 'Highlight the facilities included in a student\'s stay.',
    chatbot: 'Add helpful answers for your residents.',
    payouts: 'Connect Stripe to accept card payments.',
    review: 'Take a final look before making your listing public.',
  };
  const nextSetupTab = tabsConfig[setupStepIndex + 1];
  const nextSetupLocked = nextSetupTab && !hostelId && ['chatbot', 'payouts'].includes(nextSetupTab.id);
  const setupActionTab = !hostelId && (!nextSetupTab || nextSetupLocked) ? tabsConfig[0] : nextSetupTab;

    return (
    <div className="workspace-page space-y-6 max-w-[1240px] mx-auto pb-12">
      {/* Main Title & Header */}
      <PageHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1329] tracking-tight">{hostelId ? 'Hostel Configuration' : 'Set up your hostel'}</h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">{hostelId ? 'Manage property details, resident information, and rent payouts.' : 'Complete these setup steps to open your property workspace.'}</p>
        </div>

        {location && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
            <MapPin className="w-3.5 h-3.5 text-slate-600" />
            <span className="truncate max-w-[280px]">{location}</span>
          </div>
        )}
      </PageHeader>

      {isDraft && (
        <section className="hostel-setup-progress" aria-label="Hostel setup progress">
          <div className="hostel-setup-progress-heading">
            <div className="hostel-setup-current">
              <span className="hostel-setup-current-icon" aria-hidden="true"><SetupStepIcon /></span>
              <div><p>Property setup</p><h2>{currentSetupTab.label}</h2></div>
            </div>
            <span className="hostel-setup-position">Step <strong>{setupStepIndex + 1}</strong><span> / {tabsConfig.length}</span></span>
          </div>
          <div className="sr-only" role="progressbar" aria-label="Current setup step" aria-valuemin={1} aria-valuemax={tabsConfig.length} aria-valuenow={setupStepIndex + 1} aria-valuetext={`Step ${setupStepIndex + 1} of ${tabsConfig.length}: ${currentSetupTab.label}`} />
          <nav className="hostel-setup-segments" aria-label="Jump to a setup step">
            {tabsConfig.map((tab, index) => {
              const isActive = activeTab === tab.id;
              const isLocked = !hostelId && ['chatbot', 'payouts'].includes(tab.id);
              return (
                <button
                  key={tab.id}
                  type="button"
                  disabled={isLocked}
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={`Step ${index + 1} of ${tabsConfig.length}: ${tab.label}. ${setupStatus[tab.id]}${isLocked ? '. Save property details to unlock' : ''}`}
                  title={isLocked ? `${tab.label}: save property details to unlock` : `${tab.label}: ${setupStatus[tab.id]}`}
                  className={`hostel-setup-segment ${setupStatus[tab.id] === 'Configured' ? 'is-configured' : ''} ${isActive ? 'is-current' : ''}`}
                ><span aria-hidden="true" /></button>
              );
            })}
          </nav>
          <div className="hostel-setup-progress-footer">
            <p>{nextSetupLocked || (!hostelId && activeTab === 'review') ? 'Save your property details to unlock the remaining setup.' : setupDescriptions[activeTab]}</p>
            {setupActionTab && <button type="button" className="hostel-setup-next" disabled={setupBusy} onClick={() => { if (!hostelId && setupActionTab.id === 'property') setActiveTab('property'); else void handleAdvanceSetup(activeTab); }}>{setupBusy ? 'Saving…' : !hostelId && setupActionTab.id === 'property' ? 'Open property details' : activeTab === 'payouts' ? 'Continue to review' : 'Save & continue'}<ArrowRight aria-hidden="true" /></button>}
          </div>
        </section>
      )}

      {/* Top Horizontal Tab Navigation Bar */}
      <div 
        className="bg-white rounded-2xl border border-slate-200/80 p-1.5 shadow-2xs"
        onKeyDown={handleTabKeyDown}
      >
        <ScrollableTabs
          role="tablist"
          aria-label="Hostel Configuration Tabs"
          className="flex items-center gap-1.5 overflow-x-auto scroll-thin scroll-smooth"
        >
          {tabsConfig.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-btn-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                disabled={!hostelId && ['chatbot', 'payouts'].includes(tab.id)}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`${tab.id === 'review' ? 'listing-status-tab ' : ''}group relative flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1329]/30 ${
                  isActive
                    ? 'text-[#0b1329] bg-slate-100/90 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-[#0b1329]' : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                />
                <span className="whitespace-nowrap">{tab.label}</span>
                {tab.id === 'review' && <span className={`listing-status-tab-dot ${isDraft ? '' : 'is-published'}`} aria-hidden="true" />}

                {tab.badge !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold transition-colors ${
                      isActive
                        ? 'bg-[#0b1329] text-white'
                        : 'bg-slate-200/80 text-slate-600 group-hover:bg-slate-200'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}

                {/* Subtle active indicator underline */}
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#0b1329] rounded-full" />
                )}
              </button>
            );
          })}
        </ScrollableTabs>
      </div>

      {!isDraft && pendingSetupTabs.length > 0 && (
        <section className="hostel-setup-followup" aria-label="Pending optional setup">
          <div><span className="hostel-setup-followup-icon" aria-hidden="true"><Sparkles /></span><div><h2>Finish your optional setup</h2><p>Your listing is live. Complete these sections whenever you are ready.</p></div></div>
          <div className="hostel-setup-followup-actions">{pendingSetupTabs.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} aria-label={`Complete setup: ${tab.label}`}>{tab.label}<ArrowUpRight aria-hidden="true" /></button>)}</div>
        </section>
      )}

      {/* Tab Panels: Active Tab Content Only */}
      <div className="pt-1">
        {/* TAB 1: PROPERTY DETAILS */}
        {activeTab === 'property' && (
          <div
            role="tabpanel"
            id="tabpanel-property"
            aria-labelledby="tab-btn-property"
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            {/* Left Property Form Column */}
            <div className="lg:col-span-7 space-y-6">
              <form onSubmit={(event) => { event.preventDefault(); if (isDraft) void handleAdvanceSetup('property'); else void handlePublish(); }} className="space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        PROPERTY IDENTITY & LOCATION
                      </p>
                      <h2 className="text-sm font-bold text-[#0b1329] mt-0.5">Primary Property Details</h2>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                      {hostelId ? 'REGISTERED' : 'NEW ONBOARDING'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    Set up your primary hostel branch details. These will identify your property across resident bookings, rent invoices, and live search cards.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="hostel-name" className="block text-xs font-bold text-slate-700 mb-1.5">
                        Hostel Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="hostel-name"
                        type="text"
                        required
                        value={hostelName}
                        onChange={(e) => setHostelName(e.target.value)}
                        placeholder="e.g. Royal Residency"
                        className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0b1329]/20 text-slate-800 placeholder:text-slate-400 font-medium"
                      />
                    </div>

                    <div>
                      <label htmlFor="price-tier" className="block text-xs font-bold text-slate-700 mb-1.5">
                        Monthly Base Rent (Rs.) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="price-tier"
                        type="number"
                        min={0}
                        required
                        value={priceTier}
                        onChange={(e) => setPriceTier(Number(e.target.value))}
                        placeholder="18000"
                        className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0b1329]/20 text-slate-800 placeholder:text-slate-400 font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="city-location" className="block text-xs font-bold text-slate-700 mb-1.5">
                      Complete Street & City Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="city-location"
                      type="text"
                      required
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Plot 14, Sector Y, Phase 5, DHA, Lahore"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0b1329]/20 text-slate-800 placeholder:text-slate-400 font-medium"
                    />
                  </div>

                  {/* Section: Operational Timings & Rules (Single Source of Truth) */}
                  <div className="pt-3 border-t border-slate-100 space-y-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        OPERATIONAL TIMINGS & HOUSE RULES
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        These official details are displayed on resident property cards and ground the AI chatbot directly.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <TimePicker
                        id="gate-open-time"
                        label="Gate Opening Time"
                        value={gateOpenTime}
                        onChange={setGateOpenTime}
                        placeholder="Select opening time"
                        suggestedTimes={['05:00', '06:00', '07:00']}
                        disabled={setupBusy}
                      />
                      <TimePicker
                        id="gate-close-time"
                        label="Gate Closing Time / Curfew"
                        value={gateCloseTime}
                        onChange={setGateCloseTime}
                        placeholder="Select closing time"
                        suggestedTimes={['21:00', '22:00', '23:00']}
                        disabled={setupBusy}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <PhoneInputWithCountry
                          id="reception-contact"
                          label="Reception / Warden Contact"
                          optional
                          value={receptionContact}
                          country={receptionCountry}
                          onChangeNumber={(val) => {
                            setReceptionContact(val);
                            if (receptionPhoneError) setReceptionPhoneError(null);
                          }}
                          onSelectCountry={setReceptionCountry}
                          error={receptionPhoneError}
                          showValidBadge
                          helperText="Stored in international E.164 format (e.g. +923012345678)."
                        />
                      </div>

                      <div>
                        <label htmlFor="nearby-landmarks" className="block text-xs font-bold text-slate-700 mb-1.5">
                          Nearby Landmarks
                        </label>
                        <input
                          id="nearby-landmarks"
                          type="text"
                          value={nearbyLandmarks}
                          onChange={(e) => setNearbyLandmarks(e.target.value)}
                          placeholder="e.g. Near FAST-NU, Ring Road Interchange"
                          className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0b1329]/20 text-slate-800 placeholder:text-slate-400 font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="house-rules" className="block text-xs font-bold text-slate-700 mb-1.5">
                        House Rules (one rule per line)
                      </label>
                      <textarea
                        id="house-rules"
                        rows={4}
                        value={houseRulesText}
                        onChange={(e) => setHouseRulesText(e.target.value)}
                        placeholder="No smoking inside hostel&#10;Residents must return before gate closing time&#10;Visitors are not allowed after 10 PM&#10;No loud music after 11 PM"
                        className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0b1329]/20 text-slate-800 placeholder:text-slate-400 font-medium"
                      />
                    </div>
                  </div>

                  {/* Submit Button for Property Details */}
                  <div className="hostel-save-actions pt-2">
                    <button
                      type="submit"
                      disabled={setupBusy}
                      className="w-full py-3 px-4 bg-[#0b1329] text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-2xs disabled:opacity-75 uppercase tracking-wider cursor-pointer"
                    >
                      {isCreating || isUpdating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving Property Details...</span>
                        </>
                      ) : (
                        <>
                          <span>{isDraft ? hostelId ? 'Save & Continue' : 'Save Draft & Continue' : 'Save Property Details'}</span>
                          <Rocket className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="property-live-preview">
                <div className="property-preview-heading"><span>Live preview</span><span>Student listing</span></div>
                <div className="property-preview-banner">
                  {bannerImage ? (
                    <img src={bannerImage} alt="Hostel cover preview" />
                  ) : (
                    <div className="property-preview-placeholder"><ImageIcon aria-hidden="true" /><span>Choose a cover photo in Hostel Images</span></div>
                  )}
                </div>
                <div className="property-preview-content">
                  <div className="property-preview-title-row"><div><h2>{hostelName.trim() || 'Your hostel name'}</h2><p><MapPin aria-hidden="true" />{location.trim() || 'Your property address'}</p></div><div className="property-preview-price"><strong>PKR {Number(priceTier || 0).toLocaleString()}</strong><span>per month</span></div></div>
                  {(gateOpenTime || gateCloseTime || receptionContact || nearbyLandmarks) && <div className="property-preview-details">
                    {(gateOpenTime || gateCloseTime) && <span>Gate hours <strong>{gateOpenTime || 'Not set'}–{gateCloseTime || 'Not set'}</strong></span>}
                    {receptionContact && <span>Reception <strong>{formatPhoneDisplay((() => { const value = validateAndFormatPhone(receptionContact, receptionCountry.code); return value.isValid && value.e164 ? value.e164 : receptionContact; })())}</strong></span>}
                    {nearbyLandmarks && <span>Nearby <strong>{nearbyLandmarks}</strong></span>}
                  </div>}
                  <div className="property-preview-amenities">
                    {amenities.wifi && <span><Wifi aria-hidden="true" />Wi-Fi</span>}
                    {amenities.ac && <span><Snowflake aria-hidden="true" />Air conditioning</span>}
                    {amenities.generator && <span><Zap aria-hidden="true" />Power backup</span>}
                    {amenities.laundry && <span><Shirt aria-hidden="true" />Laundry</span>}
                    {!getSelectedFacilities().length && <span className="preview-muted">Amenities will appear here</span>}
                  </div>
                </div>
                <div className="property-preview-footer"><span>Preview updates as you edit</span><span>{galleryImages.length} gallery photo{galleryImages.length === 1 ? '' : 's'}</span></div>
              </div>
              <p className="property-preview-note">The cover image is displayed in full inside a fixed preview frame. Students see the published version in Explore.</p>
            </div>
          </div>
        )}
        {/* TAB 2: HOSTEL IMAGES */}
        {activeTab === 'images' && (
          <div
            role="tabpanel"
            id="tabpanel-images"
            aria-labelledby="tab-btn-images"
            className="space-y-6"
          >
            {/* Dedicated Hostel Banner Image Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      HOSTEL BANNER IMAGE (HERO COVER)
                    </p>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                      ImageKit CDN
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-[#0b1329] mt-0.5">Primary Hostel Cover Banner</h3>
                </div>
                <span className="text-[11px] font-medium text-slate-400">Single Dedicated Cover</span>
              </div>

              <p className="text-xs text-slate-500">
                Upload exactly one primary banner image representing your hostel. Stored securely on ImageKit CDN and kept strictly separate from the gallery collection.
                <span className="mt-1 block"><strong className="font-semibold text-slate-700">Recommended resolution:</strong> 1600 × 900 px (16:9). Keep the main subject centered because the banner crops to fit different screens.</span>
              </p>

              <input
                ref={bannerInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleBannerFileSelect}
                className="hidden"
              />

              {bannerImage ? (
                <div className="banner-image-preview">
                  <img src={bannerImage} alt="Hostel banner preview" />
                  <div className="banner-image-actions">
                    <span><Camera aria-hidden="true" /> Primary cover</span>
                    <div>
                      <button type="button" onClick={() => bannerInputRef.current?.click()} disabled={isUploadingBanner}>
                        {isUploadingBanner ? <Loader2 aria-hidden="true" className="animate-spin" /> : <RefreshCw aria-hidden="true" />}
                        {isUploadingBanner ? 'Uploading…' : 'Replace image'}
                      </button>
                      <button type="button" onClick={handleRemoveBanner} aria-label="Remove banner image" className="banner-remove-button"><Trash2 aria-hidden="true" /> Remove</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => !isUploadingBanner && bannerInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                    isUploadingBanner
                      ? 'border-indigo-300 bg-indigo-50/30 cursor-wait'
                      : 'border-slate-300 hover:border-[#0b1329] hover:bg-slate-50/60 cursor-pointer'
                  }`}
                >
                  {isUploadingBanner ? (
                    <div className="flex flex-col items-center justify-center space-y-2 py-2">
                      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                      <p className="text-xs font-bold text-slate-700">Uploading banner to ImageKit CDN...</p>
                      <p className="text-[11px] text-slate-400">Optimizing and storing image securely.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                      <div className="text-xs font-bold text-[#0b1329]">
                        Click to upload hostel banner image
                      </div>
                      <p className="text-[11px] text-slate-400">
                        PNG, JPG, or WEBP (Max 5MB). Stored on ImageKit CDN.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Hostel Gallery Images Section */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      HOSTEL GALLERY IMAGES
                    </p>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                        galleryImages.length >= MAX_GALLERY_IMAGES
                          ? 'text-amber-700 bg-amber-50 border-amber-200/80'
                          : 'text-indigo-700 bg-indigo-50 border-indigo-200/60'
                      }`}
                    >
                      {galleryImages.length} / {MAX_GALLERY_IMAGES} photos
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-[#0b1329] mt-0.5">Rooms & Facility Gallery</h3>
                </div>
                <span className="text-[11px] font-medium text-slate-400">
                  {galleryImages.length >= MAX_GALLERY_IMAGES
                    ? 'Maximum Reached (5/5)'
                    : `${MAX_GALLERY_IMAGES - galleryImages.length} Slots Left`}
                </span>
              </div>

              <p className="text-xs text-slate-500">
                Upload up to 5 photos of student bedrooms, washrooms, study areas, and building exterior. Stored separately in the gallery collection.
                <span className="mt-1 block"><strong className="font-semibold text-slate-700">Recommended resolution per photo:</strong> 1200 × 800 px (3:2), landscape. Keep important details near the center because gallery previews crop to fit.</span>
              </p>

              <input
                ref={galleryInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={handleGalleryFilesSelect}
                className="hidden"
                disabled={galleryImages.length >= MAX_GALLERY_IMAGES || isUploadingGallery}
              />

              {galleryImages.length >= MAX_GALLERY_IMAGES && (
                <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-amber-800 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Maximum 5 gallery images allowed. Remove an existing image to upload another.</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 shrink-0">
                    5 / 5
                  </span>
                </div>
              )}

              {galleryImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {galleryImages.map((url, idx) => (
                    <div
                      key={`${url}-${idx}`}
                      className="relative rounded-xl overflow-hidden border border-slate-200 group bg-slate-900 aspect-video sm:aspect-square shadow-2xs"
                    >
                      <img
                        src={url}
                        alt={`Hostel photo ${idx + 1}`}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold bg-[#0b1329]/80 text-white px-1.5 py-0.5 rounded">
                            Photo #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveGalleryImage(idx)}
                            className="p-1 bg-rose-600 text-white rounded hover:bg-rose-700 transition-colors shadow-sm cursor-pointer"
                            title="Remove photo"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-[9px] text-slate-300 truncate font-mono">
                          ImageKit CDN
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Add more button tile in grid if under limit */}
                  {galleryImages.length < MAX_GALLERY_IMAGES ? (
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      disabled={isUploadingGallery}
                      className="border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-4 hover:border-[#0b1329] hover:bg-slate-50 transition-all aspect-video sm:aspect-square text-slate-600 disabled:opacity-50 cursor-pointer"
                    >
                      {isUploadingGallery ? (
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                      ) : (
                        <>
                          <Plus className="w-6 h-6 mb-1 text-slate-500" />
                          <span className="text-[11px] font-bold">Add More</span>
                          <span className="text-[9px] text-slate-400">({MAX_GALLERY_IMAGES - galleryImages.length} left)</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="border-2 border-dashed border-slate-200 bg-slate-50/70 rounded-xl flex flex-col items-center justify-center p-4 aspect-video sm:aspect-square text-center">
                      <CheckCircle2 className="w-5 h-5 mb-1 text-emerald-600" />
                      <span className="text-[11px] font-bold text-slate-700">Gallery Full</span>
                      <span className="text-[9px] text-slate-400">5 / 5 images</span>
                    </div>
                  )}
                </div>
              )}

              {galleryImages.length === 0 && (
                <div
                  onClick={() => !isUploadingGallery && galleryInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                    isUploadingGallery
                      ? 'border-indigo-300 bg-indigo-50/30 cursor-wait'
                      : 'border-slate-300 hover:border-[#0b1329] hover:bg-slate-50/60 cursor-pointer'
                  }`}
                >
                  {isUploadingGallery ? (
                    <div className="flex flex-col items-center justify-center space-y-2 py-2">
                      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                      <p className="text-xs font-bold text-slate-700">Uploading gallery photos to ImageKit CDN...</p>
                      <p className="text-[11px] text-slate-400">Processing image uploads simultaneously.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                        <Layers className="w-6 h-6" />
                      </div>
                      <div className="text-xs font-bold text-[#0b1329]">
                        Click to upload gallery photos (up to 5 photos)
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Select up to 5 PNG, JPG, or WEBP photos (Max 5MB each). Stored on ImageKit CDN.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Save Images Action Button */}
            <div className="hostel-save-actions flex justify-end pt-2">
              {isDraft && <button type="button" className="hostel-setup-secondary" disabled={setupBusy} onClick={() => requestSkipStep('images')}>{skipLabel('images')}</button>}
              <button
                type="button"
                onClick={() => { if (isDraft) void handleAdvanceSetup('images'); else void handlePublish(); }}
                disabled={setupBusy}
                className="px-6 py-3 bg-[#0b1329] text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-all flex items-center gap-2 shadow-2xs disabled:opacity-75 uppercase tracking-wider cursor-pointer"
              >
                {(isUploadingBanner || isUploadingGallery) ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading Media to ImageKit...</span>
                  </>
                ) : (isCreating || isUpdating) ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Hostel Images...</span>
                  </>
                ) : (
                  <>
                    <span>{isDraft ? 'Save & Continue' : 'Save Hostel Images'}</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: AMENITIES */}
        {activeTab === 'amenities' && (
          <div
            role="tabpanel"
            id="tabpanel-amenities"
            aria-labelledby="tab-btn-amenities"
            className="space-y-6"
          >
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    ESSENTIAL AMENITIES & FACILITIES
                  </p>
                  <h3 className="text-sm font-bold text-[#0b1329] mt-0.5">Select Property Facilities</h3>
                </div>
                <span className="text-[11px] font-medium text-slate-400">Select all that apply</span>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Highlight the key amenities available at your hostel. Verified amenities are prominently displayed to prospective student residents.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => toggleAmenity('wifi')}
                  aria-pressed={amenities.wifi}
                  className={`p-4 rounded-xl border flex flex-col items-center justify-between transition-all relative cursor-pointer text-left ${
                    amenities.wifi
                      ? 'border-[#0b1329] bg-slate-50 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className={`absolute top-2.5 right-2.5 w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                    amenities.wifi ? 'bg-[#0b1329] border-[#0b1329] text-white' : 'border-slate-300'
                  }`}>
                    {amenities.wifi && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <Wifi className={`w-5 h-5 my-2 ${amenities.wifi ? 'text-[#0b1329]' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold text-slate-800">High-Speed Wi-Fi</span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleAmenity('ac')}
                  aria-pressed={amenities.ac}
                  className={`p-4 rounded-xl border flex flex-col items-center justify-between transition-all relative cursor-pointer text-left ${
                    amenities.ac
                      ? 'border-[#0b1329] bg-slate-50 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className={`absolute top-2.5 right-2.5 w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                    amenities.ac ? 'bg-[#0b1329] border-[#0b1329] text-white' : 'border-slate-300'
                  }`}>
                    {amenities.ac && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <Snowflake className={`w-5 h-5 my-2 ${amenities.ac ? 'text-[#0b1329]' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold text-slate-800">Air Conditioning</span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleAmenity('generator')}
                  aria-pressed={amenities.generator}
                  className={`p-4 rounded-xl border flex flex-col items-center justify-between transition-all relative cursor-pointer text-left ${
                    amenities.generator
                      ? 'border-[#0b1329] bg-slate-50 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className={`absolute top-2.5 right-2.5 w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                    amenities.generator ? 'bg-[#0b1329] border-[#0b1329] text-white' : 'border-slate-300'
                  }`}>
                    {amenities.generator && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <Zap className={`w-5 h-5 my-2 ${amenities.generator ? 'text-[#0b1329]' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold text-slate-800">Power Backup</span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleAmenity('laundry')}
                  aria-pressed={amenities.laundry}
                  className={`p-4 rounded-xl border flex flex-col items-center justify-between transition-all relative cursor-pointer text-left ${
                    amenities.laundry
                      ? 'border-[#0b1329] bg-slate-50 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className={`absolute top-2.5 right-2.5 w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                    amenities.laundry ? 'bg-[#0b1329] border-[#0b1329] text-white' : 'border-slate-300'
                  }`}>
                    {amenities.laundry && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <Shirt className={`w-5 h-5 my-2 ${amenities.laundry ? 'text-[#0b1329]' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold text-slate-800">Laundry Facility</span>
                </button>
              </div>

              {/* Submit Button for Amenities */}
              <div className="hostel-save-actions flex justify-end pt-3">
                {isDraft && <button type="button" className="hostel-setup-secondary" disabled={setupBusy} onClick={() => requestSkipStep('amenities')}>{skipLabel('amenities')}</button>}
                <button
                  type="button"
                  onClick={() => { if (isDraft) void handleAdvanceSetup('amenities'); else void handlePublish(); }}
                  disabled={setupBusy}
                  className="px-6 py-3 bg-[#0b1329] text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-all flex items-center gap-2 shadow-2xs disabled:opacity-75 uppercase tracking-wider cursor-pointer"
                >
                  {isCreating || isUpdating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Amenities...</span>
                    </>
                  ) : (
                    <>
                      <span>{isDraft ? 'Save & Continue' : 'Save Amenities'}</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: AI CHATBOT KNOWLEDGE */}
        {activeTab === 'chatbot' && (
          <div
            role="tabpanel"
            id="tabpanel-chatbot"
            aria-labelledby="tab-btn-chatbot"
            className="space-y-6"
          >
            {!hostelId ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-2xs text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-500">
                  <Info className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="text-base font-bold text-[#0b1329]">Property Registration Required</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Please complete and save your basic property details in the <strong>Property Details</strong> tab first before configuring the AI Chatbot knowledge base.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('property')}
                  className="px-4 py-2 bg-[#0b1329] text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Go to Property Details
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-sm font-bold text-[#0b1329]">AI Chatbot Knowledge Base</h3>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Optional setup
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <p>
                    <strong>Property operational facts</strong> (Gate Timings, Reception Contact, Landmarks, and House Rules) are configured in the <strong>Property Details</strong> tab and are automatically synchronized to ground the AI Chatbot.
                    {' '}Extra resident knowledge is optional. Choose Set up later to continue with saved property information; the chatbot will acknowledge missing details.
                  </p>
                </div>

                {chatbotCheckFailed && <div role="alert" className="hostel-setup-error"><p>Saved chatbot knowledge could not be loaded. You can still set this up later and publish your listing.</p><button type="button" className="hostel-setup-secondary" onClick={() => { void refetchChatbotInfo(); }}>Retry</button></div>}
                {isCheckingChatbot && <p role="status" className="text-xs text-slate-500">Loading saved chatbot knowledge...</p>}
                <form onSubmit={(event) => { event.preventDefault(); if (isDraft) void handleAdvanceSetup('chatbot'); else void handleSaveChatbotInfo(); }} className="space-y-4 pt-1">
                  <fieldset disabled={isCheckingChatbot || chatbotCheckFailed || isSavingChatbot} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="chatbot-wifi" className="block text-xs font-bold text-slate-700 mb-1">
                        Resident Wi-Fi Password
                      </label>
                      <input
                        id="chatbot-wifi"
                        type="text"
                        value={wifiPassword}
                        onChange={(e) => setWifiPassword(e.target.value)}
                        placeholder="e.g. HiveGuest2024"
                        className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0b1329]/20"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Private credential — released by AI Chatbot only to checked-in residents.
                      </p>
                    </div>

                    <div>
                      <PhoneInputWithCountry
                        id="chatbot-emergency"
                        label="Emergency Contact"
                        optional
                        value={emergencyContact}
                        country={emergencyCountry}
                        onChangeNumber={(val) => {
                          setEmergencyContact(val);
                          if (emergencyPhoneError) setEmergencyPhoneError(null);
                        }}
                        onSelectCountry={setEmergencyCountry}
                        error={emergencyPhoneError}
                        showValidBadge
                        helperText="Dedicated emergency contact line for verified residents (stored in E.164)."
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="chatbot-additional" className="block text-xs font-bold text-slate-700 mb-1">
                      Additional AI Knowledge / Operational Instructions
                    </label>
                    <textarea
                      id="chatbot-additional"
                      rows={3}
                      value={additionalInfo}
                      onChange={(e) => setAdditionalInfo(e.target.value)}
                      placeholder="e.g. Generator automatically starts during scheduled power outages. Residents can contact reception for spare room keys."
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0b1329]/20"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Special operational notes passed to the AI to answer freeform resident questions.
                    </p>
                  </div>

                  </fieldset>
                  <div className="hostel-setup-actions flex justify-end pt-2">
                    {isDraft && <button type="button" className="hostel-setup-secondary" disabled={setupBusy} onClick={() => requestSkipStep('chatbot')}>{skipLabel('chatbot')}</button>}
                    <button
                      type="submit"
                      disabled={setupBusy || isCheckingChatbot || chatbotCheckFailed}
                      className="px-6 py-3 text-xs font-bold bg-[#0b1329] text-white rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:opacity-75 uppercase tracking-wider cursor-pointer"
                    >
                      {isSavingChatbot ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Updating Chatbot Knowledge...</span>
                        </>
                      ) : (
                        <>
                          <span>{isDraft ? 'Save & Continue' : 'Save Chatbot Knowledge'}</span>
                          <CheckCircle2 className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: PAYOUT SETTINGS */}
        {activeTab === 'payouts' && (
          <div
            role="tabpanel"
            id="tabpanel-payouts"
            aria-labelledby="tab-btn-payouts"
            className="space-y-6"
          >
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-slate-700" />
                  <h3 className="text-sm font-bold text-[#0b1329]">Stripe Connect Payouts</h3>
                </div>
                {stripeStatus?.isConnected ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                    CONNECTED
                  </span>
                ) : stripeStatus?.connected ? (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    SETUP INCOMPLETE
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                    NOT CONNECTED
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Connect your bank account to receive direct destination charges for online rent collections. HostelHive never holds your revenue; funds flow directly to your connected bank account through Stripe Connect.
                {' '}This step is optional. You can publish now and connect Stripe later; students cannot pay by card until setup is complete.
              </p>

              {!hostelId ? (
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600 space-y-2">
                  <p className="font-semibold text-slate-700">Notice:</p>
                  <p>Save your property details in <strong>Property Details</strong> to create a private draft, then connect your Stripe payout account. You can publish after reviewing your listing.</p>
                </div>
              ) : (
                <div className="space-y-4 pt-1">
                  <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl text-xs space-y-2">
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="font-semibold">Payout Destination:</span>
                      <span className="font-mono text-[11px] text-slate-600">
                        {stripeStatus?.isConnected
                          ? 'Stripe Connected Express Account'
                          : stripeStatus?.connected
                            ? 'Pending Verification'
                            : 'None linked'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="font-semibold">Automated Settlement:</span>
                      <span className="text-emerald-700 font-medium">Daily Direct Transfer</span>
                    </div>
                  </div>

                  <div className="flex justify-start">
                    <button
                      type="button"
                      disabled={isFetchingStripe || !hostelId || setupBusy}
                      onClick={handleConnectStripe}
                      className="py-3 px-6 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 uppercase tracking-wider cursor-pointer"
                    >
                      {isFetchingStripe ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Connecting Stripe...</span>
                        </>
                      ) : (
                        <>
                          <span>
                            {stripeStatus?.isConnected
                              ? 'Manage Stripe Account'
                              : stripeStatus?.connected
                                ? 'Continue Stripe Setup'
                                : 'Connect Stripe Account'}
                          </span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                  {isDraft && <div className="hostel-setup-actions"><button type="button" className="hostel-setup-secondary" disabled={setupBusy || isFetchingStripe} onClick={() => requestSkipStep('payouts')}>{stripeStatus?.isConnected ? 'Continue to review' : 'Set up later'}<ArrowRight aria-hidden="true" /></button></div>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {activeTab === 'review' && (
        <section role="tabpanel" id="tabpanel-review" aria-labelledby="tab-btn-review" className="listing-review">
          <header className="listing-review-heading">
            <div className="listing-review-heading-copy">
              <span className="listing-review-emblem" aria-hidden="true">{isDraft ? <Rocket /> : <Globe2 />}</span>
              <div><p className="listing-review-eyebrow">{isDraft ? 'The final step' : 'Your student-facing listing'}</p><h2>{isDraft ? 'Ready for your next residents.' : 'Your hostel is live.'}</h2><p>{isDraft ? 'Take a final look at your property before making it visible to students.' : 'Students can discover your hostel in Explore. Keep your listing up to date as things change.'}</p></div>
            </div>
            <span className={`listing-review-status ${isDraft ? 'is-draft' : 'is-live'}`}>{isDraft ? <LockKeyhole aria-hidden="true" /> : <Globe2 aria-hidden="true" />}{isDraft ? 'Private draft' : 'Published'}</span>
          </header>

          <div className="listing-review-layout">
            <div className="listing-review-main">
              <article className="listing-review-preview">
                <div className="listing-review-cover">
                  {bannerImage ? <img src={bannerImage} alt={`${hostelName || 'Hostel'} cover preview`} /> : <div className="listing-review-cover-empty"><Building2 aria-hidden="true" /><span>Your next chapter starts here</span></div>}
                  <span className="listing-review-preview-label"><ImageIcon aria-hidden="true" />Listing preview</span>
                  <button type="button" className="listing-review-cover-edit" onClick={() => setActiveTab('images')}><Camera aria-hidden="true" />{bannerImage ? 'Edit cover' : 'Add cover'}</button>
                </div>
                <div className="listing-review-property">
                  <div className="listing-review-property-title"><div><h3>{hostelName.trim() || 'Your hostel name'}</h3><p><MapPin aria-hidden="true" />{location.trim() || 'Add your property address'}</p></div><button type="button" className="listing-review-edit" onClick={() => setActiveTab('property')} aria-label="Edit property details"><Pencil aria-hidden="true" />Edit</button></div>
                  <dl className="listing-review-facts"><div><dt>Base monthly rent</dt><dd>PKR {Number(priceTier || 0).toLocaleString()}<span> / month</span></dd></div><div><dt>Gallery photos</dt><dd><ImageIcon aria-hidden="true" />{galleryImages.length}<span> photo{galleryImages.length === 1 ? '' : 's'}</span></dd></div></dl>
                  <div className="listing-review-amenities"><div className="listing-review-section-label"><h4>Amenities & facilities</h4><button type="button" className="listing-review-edit" onClick={() => setActiveTab('amenities')}>Edit amenities<ArrowUpRight aria-hidden="true" /></button></div>{reviewFacilities.length ? <ul>{reviewFacilities.map((facility) => <li key={facility}><Check aria-hidden="true" />{facility}</li>)}</ul> : <p>No amenities selected yet. You can add these anytime.</p>}</div>
                </div>
              </article>
              <div className="listing-review-note"><Info aria-hidden="true" /><p>This preview reflects your current form values. {isDraft ? 'Publishing saves these changes before your listing goes live.' : 'Save edits in their respective sections to update your published listing.'}</p></div>
            </div>

            <aside className="listing-review-readiness" aria-labelledby="listing-review-readiness-title">
              <div className="listing-review-readiness-heading"><span className="listing-review-eyebrow">{isDraft ? 'Before you go live' : 'Listing overview'}</span><h3 id="listing-review-readiness-title">{isDraft ? 'A quick final check' : 'Keep everything in sync'}</h3><p>Property details are required. Photos, amenities, extra chatbot knowledge and Stripe can be set up later.</p></div>
              <ul className="listing-review-checks">
                {reviewChecks.map((item) => {
                  const Icon = item.icon;
                  const status = setupStatus[item.tab];
                  const configured = status === 'Configured';
                  const locked = !hostelId && ['chatbot', 'payouts'].includes(item.tab);
                  return (
                    <li key={item.tab}>
                      <span className={`listing-review-check-icon ${configured ? 'is-ready' : ''}`} aria-hidden="true">{configured ? <Check /> : <Icon />}</span>
                      <div>
                        <div className="listing-review-check-title"><strong>{item.label}</strong><span>{item.required ? 'Required' : 'Optional'}</span></div>
                        <p>{item.description}</p>
                        <span className={`hostel-setup-state ${configured ? 'is-configured' : ''}`}>{status}</span>
                        {status === 'Pending' && !item.required && <button type="button" className="hostel-setup-complete" disabled={locked} onClick={() => setActiveTab(item.tab)}>Complete setup<ArrowUpRight aria-hidden="true" /></button>}
                      </div>
                      <button type="button" className="listing-review-check-link" onClick={() => setActiveTab(item.tab)} disabled={locked} aria-label={`Review ${item.label.toLowerCase()}`}><ArrowUpRight aria-hidden="true" /></button>
                    </li>
                  );
                })}
              </ul>
              {!stripeStatus?.isConnected && <div className="listing-review-payment-note"><CreditCard aria-hidden="true" /><p>Your listing can go live before Stripe is connected. Card payments become available after setup is complete.</p></div>}
              <div className="listing-review-publish">
                {isDraft ? <><div className="listing-review-publish-intro"><h4>{!hostelId ? 'Save your draft first' : reviewPropertyReady ? 'Make your hostel discoverable' : 'Complete your property details'}</h4><p>{!hostelId ? 'Create a private draft in Property Details to unlock publishing.' : 'Publishing makes this listing visible to students browsing Explore.'}</p></div><button type="button" className="auth-primary-button listing-review-publish-button" disabled={!hostelId || setupBusy} aria-busy={setupBusy} onClick={() => { void handleFinishSetup(); }}>{setupBusy ? <><Loader2 className="animate-spin" aria-hidden="true" />{isPublishing ? 'Publishing hostel…' : 'Saving listing…'}</> : <><Rocket aria-hidden="true" />Publish hostel<ArrowUpRight aria-hidden="true" /></>}</button>{!hostelId ? <button type="button" className="listing-review-draft-link" onClick={() => setActiveTab('property')}>Go to Property Details<ArrowUpRight aria-hidden="true" /></button> : <p className="listing-review-publish-caption"><LockKeyhole aria-hidden="true" />{reviewHasChanges ? 'Your latest changes will be saved when you publish.' : 'You can update your listing after publishing.'}</p>}</> : <div className="listing-review-live-note"><CheckCircle2 aria-hidden="true" /><div><h4>Visible in Explore</h4><p>{reviewHasChanges ? 'You have unsaved edits. Save them in their respective sections to update the live listing.' : 'Your saved property details are available to students.'}</p></div></div>}
              </div>
            </aside>
          </div>
        </section>
      )}
      {leaveDialog}

      <Modal
        isOpen={skipSetupTab !== null}
        onClose={() => setSkipSetupTab(null)}
        title="Set up this section later?"
        description="Unsaved changes in this section will be discarded. Your previously saved information will be kept, and you can return anytime."
      >
        <div className="hostel-setup-actions">
          <button type="button" className="hostel-setup-secondary" onClick={() => setSkipSetupTab(null)}>Keep editing</button>
          <button type="button" className="auth-primary-button" onClick={() => { if (skipSetupTab) skipOptionalStep(skipSetupTab); }}>Discard changes & continue</button>
        </div>
      </Modal>

      {/* Success Modal */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Hostel Published Successfully"
        description="Your hostel listing is now visible to students on HostelHive."
      >
        <div className="space-y-4 text-center py-2">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 stroke-[2]" />
          </div>
          <div>
            <h4 className="font-bold text-base text-[#0b1329]">{hostelName}</h4>
            <p className="text-xs text-slate-500 mt-0.5">{location}</p>
          </div>
          <div className="pt-2">
            {pendingSetupTabs.length > 0 && <div className="hostel-published-pending"><p>Optional setup is still pending. Your listing is already visible to students.</p>{pendingSetupTabs.map((tab) => <button key={tab.id} type="button" className="hostel-setup-secondary" onClick={() => { setShowSuccessModal(false); setActiveTab(tab.id); }}>Complete {tab.label}<ArrowUpRight aria-hidden="true" /></button>)}</div>}
            <button
              type="button"
              onClick={() => {
                setShowSuccessModal(false);
                allowNavigation(() => navigate('/dashboard'));
              }}
              className="mt-2 w-full rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Continue to Dashboard
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast feedback */}
      <Toast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
