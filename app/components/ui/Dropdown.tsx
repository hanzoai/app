import React, { useState, useEffect, useRef } from 'react';

interface DropdownProps {
  direction?: 'up' | 'down';
}

const Dropdown: React.FC<DropdownProps> = ({ direction = 'down' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState('public');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleOptionChange = (option: string) => {
    setSelectedOption(option);
    setIsOpen(false); // Close the dropdown after selection
  };

  const dropdownPosition = direction === 'up' ? 'absolute bottom-full right-0 mb-2' : 'absolute top-full right-0 mt-2';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className={`whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-ring enabled:hover:bg-hanzo-elements-item-backgroundActive disabled:cursor-not-allowed transition-all text-hanzo-elements-item-contentDefault hover:bg-hanzo-elements-background-depth-4 enabled:hover:text-hanzo-elements-item-contentActive rounded-md ml-auto flex h-fit items-center justify-center gap-1 px-1 py-0.5 focus-visible:ring-0 bg-hanzo-elements-background-depth-2`}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="100%"
          height="100%"
          viewBox="0 -960 960 960"
          className="shrink-0 h-4 w-4"
          fill="currentColor"
        >
          <path
            d={
              selectedOption === 'public'
                ? 'M480.27-80q-82.74 0-155.5-31.5Q252-143 197.5-197.5t-86-127.34T80-480.5t31.5-155.66 86-126.84 127.34-85.5T480.5-880t155.66 31.5T763-763t85.5 127T880-480.27q0 82.74-31.5 155.5Q817-252 763-197.68q-54 54.31-127 86Q563-80 480.27-80m-.27-60q142.38 0 241.19-99.5T820-480v-13q-6 26-27.41 43.5Q771.19-432 742-432h-80q-33 0-56.5-23.5T582-512v-40H422v-80q0-33 23.5-56.5T502-712h40v-22q0-16 13.5-40t30.5-29q-25-8-51.36-12.5Q508.29-820 480-820q-141 0-240.5 98.81T140-480h150q66 0 113 47t47 113v40H330v105q34 17 71.7 26t78.3 9'
                : 'M220-80q-24.75 0-42.37-17.63Q160-115.25 160-140v-434q0-24.75 17.63-42.38Q195.25-634 220-634h70v-96q0-78.85 55.61-134.42Q401.21-920 480.11-920q78.89 0 134.39 55.58Q670-808.85 670-730v96h70q24.75 0 42.38 17.62Q800-598.75 800-574v434q0 24.75-17.62 42.37Q764.75-80 740-80zm0-60h520v-434H220zm260.17-140q31.83 0 54.33-22.03T557-355q0-30-22.67-54.5t-54.5-24.5-54.33 24.5-22.5 55 22.67 52.5 54.5 22M350-634h260v-96q0-54.17-37.88-92.08-37.88-37.92-92-37.92T388-822.08q-38 37.91-38 92.08zM220-140v-434z'
            }
          ></path>
        </svg>
        {selectedOption.charAt(0).toUpperCase() + selectedOption.slice(1)}
      </button>
      {isOpen && (
        <div
          className={`${dropdownPosition} w-48 bg-hanzo-elements-background-depth-3 text-white rounded-md shadow-lg`}
        >
          <div
            className="p-4 hover:bg-hanzo-elements-background-depth-4 transition-colors rounded-t-md cursor-pointer"
            onClick={() => handleOptionChange('public')}
          >
            <div className="flex items-center">
              <input
                type="radio"
                name="visibility"
                value="public"
                checked={selectedOption === 'public'}
                onChange={() => handleOptionChange('public')}
                className="mr-2"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 -960 960 960"
                className="shrink-0 h-4 w-4 mr-1"
                fill="currentColor"
              >
                <path d="M480.27-80q-82.74 0-155.5-31.5Q252-143 197.5-197.5t-86-127.34T80-480.5t31.5-155.66 86-126.84 127.34-85.5T480.5-880t155.66 31.5T763-763t85.5 127T880-480.27q0 82.74-31.5 155.5Q817-252 763-197.68q-54 54.31-127 86Q563-80 480.27-80m-.27-60q142.38 0 241.19-99.5T820-480v-13q-6 26-27.41 43.5Q771.19-432 742-432h-80q-33 0-56.5-23.5T582-512v-40H422v-80q0-33 23.5-56.5T502-712h40v-22q0-16 13.5-40t30.5-29q-25-8-51.36-12.5Q508.29-820 480-820q-141 0-240.5 98.81T140-480h150q66 0 113 47t47 113v40H330v105q34 17 71.7 26t78.3 9"></path>
              </svg>
              Public
            </div>
            <p className="text-xs">Anyone can view and remix</p>
          </div>
          <div
            className="p-4 hover:bg-hanzo-elements-background-depth-4 transition-colors rounded-b-md cursor-pointer"
            onClick={() => handleOptionChange('private')}
          >
            <div className="flex items-center">
              <input
                type="radio"
                name="visibility"
                value="private"
                checked={selectedOption === 'private'}
                onChange={() => handleOptionChange('private')}
                className="mr-2"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="100%"
                height="100%"
                viewBox="0 -960 960 960"
                className="shrink-0 h-4 w-4 text-muted-foreground"
                fill="currentColor"
              >
                <path d="M220-80q-24.75 0-42.37-17.63Q160-115.25 160-140v-434q0-24.75 17.63-42.38Q195.25-634 220-634h70v-96q0-78.85 55.61-134.42Q401.21-920 480.11-920q78.89 0 134.39 55.58Q670-808.85 670-730v96h70q24.75 0 42.38 17.62Q800-598.75 800-574v434q0 24.75-17.62 42.37Q764.75-80 740-80zm0-60h520v-434H220zm260.17-140q31.83 0 54.33-22.03T557-355q0-30-22.67-54.5t-54.5-24.5-54.33 24.5-22.5 55 22.67 52.5 54.5 22M350-634h260v-96q0-54.17-37.88-92.08-37.88-37.92-92-37.92T388-822.08q-38 37.91-38 92.08zM220-140v-434z"></path>
              </svg>
              Private
            </div>
            <p className="text-xs">Build and deploy in private</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dropdown;
