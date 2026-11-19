/** Icons aus Wir Zwei v40 (gleiche Pfade), gezeichnet mit react-native-svg. */
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type P = { color: string; size?: number; width?: number };

const S = ({ color, size = 22, width = 1.9, children }: P & { children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </Svg>
);

export const IconHome = (p: P) => <S {...p}><Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></S>;
export const IconCalendar = (p: P) => <S {...p}><Rect x={3} y={4.5} width={18} height={16.5} rx={3} /><Path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></S>;
export const IconCart = (p: P) => <S {...p}><Path d="M3 4h2.5l2.2 11h10.6L20.5 8H7" /><Circle cx={9.5} cy={19.5} r={1.4} /><Circle cx={17} cy={19.5} r={1.4} /></S>;
export const IconPlus = (p: P) => <S width={2} {...p}><Path d="M12 5v14M5 12h14" /></S>;
export const IconCheck = (p: P) => <S width={3} {...p}><Path d="m5 12.5 4.5 4.5L19 7.5" /></S>;
export const IconX = (p: P) => <S width={2.2} {...p}><Path d="M6 6l12 12M18 6 6 18" /></S>;
export const IconLeft = (p: P) => <S width={2.2} {...p}><Path d="m15 5-7 7 7 7" /></S>;
export const IconRight = (p: P) => <S width={2.2} {...p}><Path d="m9 5 7 7-7 7" /></S>;
export const IconPencil = (p: P) => <S {...p}><Path d="M4 20h4L19 9l-4-4L4 16z" /><Path d="m13.5 6.5 4 4" /></S>;
export const IconGear = (p: P) => (
  <S {...p}>
    <Circle cx={12} cy={12} r={3} />
    <Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </S>
);
export const IconHeart = ({ color, size = 22 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8.1 3.6 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.6 0 5.7 3.6 4.5 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" />
  </Svg>
);
export const IconNote = (p: P) => <S {...p}><Path d="M5 3.5h10l4 4v13H5z" /><Path d="M9 11h6M9 15h6" /></S>;
export const IconHeartLine = (p: P) => <S {...p}><Path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8.1 3.6 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.6 0 5.7 3.6 4.5 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" /></S>;
export const IconClock = (p: P) => <S {...p}><Circle cx={12} cy={12} r={8.5} /><Path d="M12 7.5V12l3 2" /></S>;
export const IconMinus = (p: P) => <S width={2} {...p}><Path d="M5 12h14" /></S>;
export const IconSuitcase = (p: P) => <S {...p}><Rect x={3} y={7} width={18} height={13} rx={2.5} /><Path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 12.5h18" /></S>;
export const IconTrash = (p: P) => <S {...p}><Path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" /></S>;
export const IconPhoto = (p: P) => <S {...p}><Rect x={3} y={4.5} width={18} height={15} rx={2.5} /><Circle cx={8.5} cy={9.5} r={1.6} /><Path d="m3.5 17 5-4.5 4 3.5 3-2.5 5 4" /></S>;
export const IconStar = ({ color, size = 22, filled }: P & { filled?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={1.7} strokeLinejoin="round">
    <Path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />
  </Svg>
);
export const IconUp = (p: P) => <S width={2.2} {...p}><Path d="m5 15 7-7 7 7" /></S>;
export const IconDown = (p: P) => <S width={2.2} {...p}><Path d="m5 9 7 7 7-7" /></S>;
export const IconList = (p: P) => <S {...p}><Path d="M9 6h11M9 12h11M9 18h11" /><Path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2" /></S>;
export const IconFork = (p: P) => <S {...p}><Path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 21V3c-2.5 1.5-3.5 4-3.5 7.5V13H17" /></S>;
export const IconSliders = (p: P) => <S {...p}><Path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><Circle cx={16} cy={7} r={2} /><Circle cx={8} cy={17} r={2} /></S>;
