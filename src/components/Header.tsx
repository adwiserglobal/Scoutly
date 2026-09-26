import { memo } from 'react';
import HeaderBase from './HeaderBase';
import CreditPill from './CreditPill';

type HeaderProps = React.ComponentProps<typeof HeaderBase>;

function Header(props: HeaderProps) {
  return (
    <>
      <HeaderBase {...props} />
      <div className="pointer-events-auto fixed right-4 top-[72px] z-[68] sm:right-[112px] sm:top-4">
        <CreditPill />
      </div>
    </>
  );
}

export default memo(Header);
