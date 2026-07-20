export default function Footer() {
  return (
    <footer className="w-full py-sm px-margin-mobile lg:px-margin-desktop flex flex-col sm:flex-row justify-between items-center gap-md border-t border-secondary-container/20 bg-surface-container-lowest text-on-surface-variant text-label-sm font-label-sm">
      <div className="flex flex-col gap-xs text-center sm:text-left">
        <span className="font-label-md text-secondary">Mr YUM Bakers</span>
        <span>© {new Date().getFullYear()} Mr YUM Bakers And General Store. Artisan Crafted Excellence.</span>
      </div>
      <div className="flex gap-lg">
        <a className="text-on-surface-variant/70 hover:text-secondary transition-colors" href="#support">
          Support
        </a>
        <a className="text-on-surface-variant/70 hover:text-secondary transition-colors" href="#privacy">
          Privacy Policy
        </a>
        <a className="text-on-surface-variant/70 hover:text-secondary transition-colors" href="#terms">
          Terms of Service
        </a>
      </div>
    </footer>
  )
}
