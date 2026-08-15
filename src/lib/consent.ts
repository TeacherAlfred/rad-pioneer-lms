// Shared between the public /consent/[token] wizard and its API route.
// See RAD_Consent_and_Medical_Form_Spec.md - field names here mirror the
// spec's section numbers in comments so the two stay easy to cross-check.
export const CONSENT_WORDING_VERSION = 'v1.0';

// A record older than this needs a full review, not a one-tap confirm
// (spec 5.3). 90 days for a fresh booking on an older record; 12 months
// is the hard ceiling regardless of booking activity.
export const CONFIRM_WINDOW_DAYS = 90;
export const FULL_REVIEW_MAX_DAYS = 365;

export const RELATIONSHIP_OPTIONS = ['Mother', 'Father', 'Guardian', 'Other'];
export const ALLERGY_SEVERITY_OPTIONS = ['Mild', 'Moderate', 'Severe - anaphylaxis risk'];
export const GRADE_OPTIONS = [
  'Not yet at school', 'Grade R',
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
  'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
  'Other',
];

export type PhotoTierKey = 'tier1' | 'tier2' | 'tier3' | 'tier4' | 'tier5Video';
export type PhotoTierGroup = 'private' | 'paid' | 'video';

export const PHOTO_TIER_GROUPS: { key: PhotoTierGroup; label: string; help: string }[] = [
  { key: 'private', label: 'Private & Organic', help: "Shared only where your child's own circle can see it." },
  { key: 'paid', label: 'Paid Advertising', help: 'A materially bigger step than the above - used in Meta ads and other paid placements.' },
  { key: 'video', label: 'Video', help: 'Extends whatever you ticked above to video, not just photos.' },
];

export const PHOTO_TIERS: { key: PhotoTierKey; label: string; help: string; group: PhotoTierGroup }[] = [
  { key: 'tier1', label: "My child's own progress record", help: 'Shared only with you, in their parent-facing progress view.', group: 'private' },
  { key: 'tier2', label: 'Shared with other families from the same session', help: "A closed circle - just the other parents from your child's session, never posted publicly.", group: 'private' },
  { key: 'tier3', label: "RAD Academy's website and social media", help: 'Public, organic posts - not paid promotion.', group: 'private' },
  { key: 'tier4', label: "RAD Academy's paid advertising", help: 'Used in Meta ads and other paid placements.', group: 'paid' },
  { key: 'tier5Video', label: 'Video, under whatever tiers above are ticked', help: 'Extends your selection above to video as well as photos.', group: 'video' },
];

export type ConsentGuardian = {
  fullName: string;
  relationship: string;
  mobile: string;
  email: string;
  alternateContact: string;
  authorityConfirmed: boolean;
};

export type ConsentChild = {
  fullName: string;
  preferredName: string;
  dateOfBirth: string;
  school: string;
  grade: string;
};

export type ConsentMedical = {
  foodAllergies: string;
  foodAllergyIsNone: boolean;
  foodAllergySeverity: string;
  environmentalAllergies: string;
  environmentalAllergyIsNone: boolean;
  medicationAllergies: string;
  medicationAllergyIsNone: boolean;
  chronicConditions: string;
  chronicConditionIsNone: boolean;
  medicationDuringSession: string;
  medicationDuringSessionIsNone: boolean;
  selfAdministers: string;
  educatorNotes: string;
  supportNeeds: string;
  emergencyMedicalAuthorised: boolean;
};

export type ConsentContact = { fullName: string; relationship: string; mobile: string; alternate: string };
export type OtherGuardianContact = { id: string; name: string; phone: string };

export type ConsentEmergency = {
  primary: ConsentContact;
  hasSecond: boolean;
  second: ConsentContact;
  // Co-guardians linked to this child (besides whoever is filling in the
  // form) that this guardian has agreed may also be contacted in an
  // emergency. Snapshotted with name/phone at submission time, not just
  // an id, so the versioned payload stays self-contained if that
  // guardian's own details change later.
  otherGuardiansToContact: OtherGuardianContact[];
};

export type ConsentCollection = {
  authorisedCollectors: { name: string; relationship: string }[];
  mayTravelUnaccompanied: boolean | null;
  mustNotCollect: string;
};

export type ConsentPhoto = {
  tier1: boolean; tier2: boolean; tier3: boolean; tier4: boolean; tier5Video: boolean;
  identifyByFirstName: boolean;
  groupPhotosOnly: boolean;
  // Two deliberately separate ticks: a child can agree to answer a
  // feedback form, but only a guardian can consent to that answer being
  // published - one does not imply the other.
  feedbackFormConsent: boolean;
  feedbackQuoteConsent: boolean;
};

export type ConsentPayload = {
  guardian: ConsentGuardian;
  child: ConsentChild;
  medical: ConsentMedical;
  emergencyContact: ConsentEmergency;
  collection: ConsentCollection;
  photo: ConsentPhoto;
};

export function emptyConsentPayload(): ConsentPayload {
  return {
    guardian: { fullName: '', relationship: '', mobile: '', email: '', alternateContact: '', authorityConfirmed: false },
    child: { fullName: '', preferredName: '', dateOfBirth: '', school: '', grade: '' },
    medical: {
      foodAllergies: '', foodAllergyIsNone: false, foodAllergySeverity: '',
      environmentalAllergies: '', environmentalAllergyIsNone: false,
      medicationAllergies: '', medicationAllergyIsNone: false,
      chronicConditions: '', chronicConditionIsNone: false,
      medicationDuringSession: '', medicationDuringSessionIsNone: false,
      selfAdministers: '', educatorNotes: '', supportNeeds: '',
      emergencyMedicalAuthorised: false,
    },
    emergencyContact: {
      primary: { fullName: '', relationship: '', mobile: '', alternate: '' },
      hasSecond: false,
      second: { fullName: '', relationship: '', mobile: '', alternate: '' },
      otherGuardiansToContact: [],
    },
    collection: { authorisedCollectors: [], mayTravelUnaccompanied: null, mustNotCollect: '' },
    photo: {
      tier1: false, tier2: false, tier3: false, tier4: false, tier5Video: false,
      identifyByFirstName: false, groupPhotosOnly: false,
      feedbackFormConsent: false, feedbackQuoteConsent: false,
    },
  };
}

export function ageFromDob(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  const beforeBirthday = now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate());
  if (beforeBirthday) years -= 1;
  return years;
}

export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
