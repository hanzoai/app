import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <img 
      src="/hanzo-logo.svg" 
      alt="Hanzo AI" 
      className={className}
    />
  );
};

export default Logo;
