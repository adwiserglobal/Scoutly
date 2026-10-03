import { AppWindow } from 'lucide-react';

export type BrandName =
  | 'google'
  | 'googleMaps'
  | 'googleAds'
  | 'website'
  | 'whatsapp'
  | 'meta'
  | 'facebook'
  | 'instagram'
  | 'youtube'
  | 'tiktok'
  | 'linkedin';

const BRAND_SOURCES: Record<BrandName, string> = {
  google: 'https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png',
  googleMaps: '/brand-icons/google-maps.png',
  website: '/brand-icons/site-white.png',
  googleAds: '/google-ads-logo.png',
  whatsapp: '/brand-icons/whatsapp.png',
  meta: 'https://cdn.simpleicons.org/meta/0866FF',
  facebook: 'https://cdn.simpleicons.org/facebook/1877F2',
  instagram: '/brand-icons/instagram.png',
  youtube: '/brand-icons/youtube.png',
  tiktok: '/brand-icons/tiktok.png',
  linkedin: '/brand-icons/linkedin.png',
};

export function brandFromUrl(value?: string | null): BrandName | null {
  const url = String(value || '').toLowerCase();
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('facebook.com') || url.includes('fb.com')) return 'facebook';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('linkedin.com')) return 'linkedin';
  if (url.includes('wa.me') || url.includes('whatsapp.com')) return 'whatsapp';
  if (url.includes('google.com/maps') || url.includes('maps.google')) return 'googleMaps';
  return null;
}

export function BrandIcon({
  brand,
  className = 'h-4 w-4',
  alt,
}: {
  brand: BrandName;
  className?: string;
  alt?: string;
}) {
  if (brand === 'website') {
    return <AppWindow className={`${className} shrink-0 text-[#eef0f4]`} aria-label={alt ?? 'Site'} />;
  }

  return (
    <span
      role="img"
      aria-label={alt ?? brand}
      className="inline-flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-white/[0.12]"
    >
      <img
        src={BRAND_SOURCES[brand]}
        alt=""
        className={`${className} max-h-[16px] max-w-[16px] shrink-0 rounded-none object-contain`}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </span>
  );
}

export default BrandIcon;
