import {
  AlertCircle as RawAlertCircle,
  AlertTriangle as RawAlertTriangle,
  ArrowLeft as RawArrowLeft,
  BellIcon as RawBellIcon,
  BookOpenIcon as RawBookOpenIcon,
  Box as RawBox,
  BuildingIcon as RawBuildingIcon,
  Calendar as RawCalendar,
  CalendarClock as RawCalendarClock,
  CalendarClockIcon as RawCalendarClockIcon,
  CalendarIcon as RawCalendarIcon,
  CheckCircle as RawCheckCircle,
  CheckCircleIcon as RawCheckCircleIcon,
  CheckIcon as RawCheckIcon,
  ChevronDownIcon as RawChevronDownIcon,
  ChevronRight as RawChevronRight,
  ChevronRightIcon as RawChevronRightIcon,
  ChevronUpIcon as RawChevronUpIcon,
  Circle as RawCircle,
  ClipboardListIcon as RawClipboardListIcon,
  Clock as RawClock,
  ClockIcon as RawClockIcon,
  CloudLightning as RawCloudLightning,
  Edit2Icon as RawEdit2Icon,
  EditIcon as RawEditIcon,
  ExpandIcon as RawExpandIcon,
  ExternalLink as RawExternalLink,
  EyeIcon as RawEyeIcon,
  EyeOffIcon as RawEyeOffIcon,
  FileTextIcon as RawFileTextIcon,
  GlobeIcon as RawGlobeIcon,
  HomeIcon as RawHomeIcon,
  LinkIcon as RawLinkIcon,
  Loader2 as RawLoader2,
  LockKeyhole as RawLockKeyhole,
  type LucideProps,
  Mail as RawMail,
  MailIcon as RawMailIcon,
  MapPinIcon as RawMapPinIcon,
  MessageCircleIcon as RawMessageCircleIcon,
  MessagesSquareIcon as RawMessagesSquareIcon,
  MoreVertical as RawMoreVertical,
  MoreVerticalIcon as RawMoreVerticalIcon,
  NetworkIcon as RawNetworkIcon,
  Phone as RawPhone,
  PhoneIcon as RawPhoneIcon,
  PlusIcon as RawPlusIcon,
  RadioIcon as RawRadioIcon,
  SearchIcon as RawSearchIcon,
  SettingsIcon as RawSettingsIcon,
  ShieldAlertIcon as RawShieldAlertIcon,
  ShieldCheckIcon as RawShieldCheckIcon,
  SmartphoneIcon as RawSmartphoneIcon,
  StarIcon as RawStarIcon,
  Tag as RawTag,
  TimerIcon as RawTimerIcon,
  Trash2 as RawTrash2,
  Trash2Icon as RawTrash2Icon,
  TrashIcon as RawTrashIcon,
  Truck as RawTruck,
  User as RawUser,
  UserCogIcon as RawUserCogIcon,
  UserIcon as RawUserIcon,
  UserPlusIcon as RawUserPlusIcon,
  Users as RawUsers,
  UsersIcon as RawUsersIcon,
  X as RawX,
  XIcon as RawXIcon,
} from 'lucide-react-native';
import { styled } from 'nativewind';
import type React from 'react';

/**
 * lucide icons that understand `className`.
 *
 * nativewind v5 dropped the JSX transform: a `className` only has an effect on a component
 * that has been through `styled()`, and metro's polyfill only covers `react-native` itself.
 * On a raw lucide icon the class was silently discarded -- which is why `text-*` colours and
 * `mr-*` spacing had no effect and icons rendered with their default near-black stroke.
 *
 * `target: 'style'` keeps layout utilities working, and `nativeStyleMapping` lifts the
 * resolved colour out of the style object onto lucide's `color` prop, which is where
 * react-native-svg resolves `currentColor` from.
 *
 * Only icons used with a className live here, so the bundle is unchanged; import the rest
 * straight from `lucide-react-native`.
 */
const iconMapping = {
  className: {
    target: 'style',
    nativeStyleMapping: {
      color: 'color',
    },
  },
} as const;

type LucideIcon = React.ComponentType<LucideProps>;

const themed = <T extends LucideIcon>(Component: T): T => styled(Component as LucideIcon, iconMapping) as unknown as T;

export const AlertCircle = themed(RawAlertCircle);
export const AlertTriangle = themed(RawAlertTriangle);
export const ArrowLeft = themed(RawArrowLeft);
export const BellIcon = themed(RawBellIcon);
export const BookOpenIcon = themed(RawBookOpenIcon);
export const Box = themed(RawBox);
export const BuildingIcon = themed(RawBuildingIcon);
export const Calendar = themed(RawCalendar);
export const CalendarClock = themed(RawCalendarClock);
export const CalendarClockIcon = themed(RawCalendarClockIcon);
export const CalendarIcon = themed(RawCalendarIcon);
export const CheckCircle = themed(RawCheckCircle);
export const CheckCircleIcon = themed(RawCheckCircleIcon);
export const CheckIcon = themed(RawCheckIcon);
export const ChevronDownIcon = themed(RawChevronDownIcon);
export const ChevronRight = themed(RawChevronRight);
export const ChevronRightIcon = themed(RawChevronRightIcon);
export const ChevronUpIcon = themed(RawChevronUpIcon);
export const Circle = themed(RawCircle);
export const ClipboardListIcon = themed(RawClipboardListIcon);
export const Clock = themed(RawClock);
export const ClockIcon = themed(RawClockIcon);
export const CloudLightning = themed(RawCloudLightning);
export const Edit2Icon = themed(RawEdit2Icon);
export const EditIcon = themed(RawEditIcon);
export const ExpandIcon = themed(RawExpandIcon);
export const ExternalLink = themed(RawExternalLink);
export const EyeIcon = themed(RawEyeIcon);
export const EyeOffIcon = themed(RawEyeOffIcon);
export const FileTextIcon = themed(RawFileTextIcon);
export const GlobeIcon = themed(RawGlobeIcon);
export const HomeIcon = themed(RawHomeIcon);
export const LinkIcon = themed(RawLinkIcon);
export const Loader2 = themed(RawLoader2);
export const LockKeyhole = themed(RawLockKeyhole);
export const Mail = themed(RawMail);
export const MailIcon = themed(RawMailIcon);
export const MapPinIcon = themed(RawMapPinIcon);
export const MessageCircleIcon = themed(RawMessageCircleIcon);
export const MessagesSquareIcon = themed(RawMessagesSquareIcon);
export const MoreVertical = themed(RawMoreVertical);
export const MoreVerticalIcon = themed(RawMoreVerticalIcon);
export const NetworkIcon = themed(RawNetworkIcon);
export const Phone = themed(RawPhone);
export const PhoneIcon = themed(RawPhoneIcon);
export const PlusIcon = themed(RawPlusIcon);
export const RadioIcon = themed(RawRadioIcon);
export const SearchIcon = themed(RawSearchIcon);
export const SettingsIcon = themed(RawSettingsIcon);
export const ShieldAlertIcon = themed(RawShieldAlertIcon);
export const ShieldCheckIcon = themed(RawShieldCheckIcon);
export const SmartphoneIcon = themed(RawSmartphoneIcon);
export const StarIcon = themed(RawStarIcon);
export const Tag = themed(RawTag);
export const TimerIcon = themed(RawTimerIcon);
export const Trash2 = themed(RawTrash2);
export const Trash2Icon = themed(RawTrash2Icon);
export const TrashIcon = themed(RawTrashIcon);
export const Truck = themed(RawTruck);
export const User = themed(RawUser);
export const UserCogIcon = themed(RawUserCogIcon);
export const UserIcon = themed(RawUserIcon);
export const UserPlusIcon = themed(RawUserPlusIcon);
export const Users = themed(RawUsers);
export const UsersIcon = themed(RawUsersIcon);
export const X = themed(RawX);
export const XIcon = themed(RawXIcon);
