import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';

const Footer = () => {
  const [showFooter, setShowFooter] = useState(false);

  useEffect(() => {
    const handleMouseWheel = (event: WheelEvent) => {
      if (event.deltaY > 0) {
        setShowFooter(true);
      } else if (event.deltaY < 0 && window.pageYOffset === 0) {
        setShowFooter(false);
      }
    };

    window.addEventListener('wheel', handleMouseWheel);

    return () => {
      window.removeEventListener('wheel', handleMouseWheel);
    };
  }, []);

  return (
    <footer
      className={`bottom-0 left-0 right-0 transition-transform duration-300 ${
        showFooter ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <img src="/logo-dark.png" alt="Hanzo" className="h-8 w-8" />
              <span className="text-white font-bold text-xl">Hanzo</span>
            </div>
            <a
              href="https://hanzo.industries/status"
              target="_blank"
              className="inline-flex items-center space-x-2 text-gray-400 hover:text-white mb-4"
            >
              <Check className="h-4 w-4 text-green-500" />
              <span>All systems operational</span>
            </a>
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-gray-500 text-sm">© {new Date().getFullYear()} Hanzo Industries, Inc. All rights reserved.</div>
            <div className="flex space-x-6">
              <a
                href="https://hanzo.industries/privacy"
                target="_blank"
                className="text-gray-500 hover:text-white text-sm"
              >
                Privacy Policy
              </a>
              <a
                href="https://hanzo.industries/terms"
                target="_blank"
                className="text-gray-500 hover:text-white text-sm"
              >
                Terms of Service
              </a>
              <a
                href="https://hanzo.industries/security"
                target="_blank"
                className="text-gray-500 hover:text-white text-sm"
              >
                Security
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
