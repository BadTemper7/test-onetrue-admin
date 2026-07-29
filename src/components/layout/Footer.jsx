import React from "react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-slate-200 py-4 px-4 md:px-6">
      <div className="flex flex-col sm:flex-row items-center justify-between text-sm text-slate-500">
        <p>
          <span className="font-mono text-[11px] tracking-wide text-slate-400">
            OTLI
          </span>{" "}
          © {currentYear} Yard operations. All rights reserved.
        </p>
        <div className="flex items-center space-x-4 mt-2 sm:mt-0">
          <a href="#" className="hover:text-yard-navy transition-colors">
            Privacy policy
          </a>
          <a href="#" className="hover:text-yard-navy transition-colors">
            Terms of service
          </a>
          <a href="#" className="hover:text-yard-navy transition-colors">
            Support
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
