export function Footer() {
  return (
    <footer className="py-12 px-6 bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8 mb-12">
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-[#565b96] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">C</span>
            </div>
            <span className="font-bold">CiteXai</span>
          </div>
          <p className="text-sm text-gray-600">Verify citations. Stay honest. Save grades.</p>
        </div>
        <div>
          <h4 className="font-semibold mb-4">Product</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li><a href="#" className="hover:text-[#565b96]">Features</a></li>
            <li><a href="#" className="hover:text-[#565b96]">Pricing</a></li>
            <li><a href="#" className="hover:text-[#565b96]">FAQ</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-4">Company</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li><a href="#" className="hover:text-[#565b96]">About</a></li>
            <li><a href="#" className="hover:text-[#565b96]">Blog</a></li>
            <li><a href="#" className="hover:text-[#565b96]">Contact</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-4">Legal</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li><a href="#" className="hover:text-[#565b96]">Privacy</a></li>
            <li><a href="#" className="hover:text-[#565b96]">Terms</a></li>
            <li><a href="#" className="hover:text-[#565b96]">Cookies</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-200 pt-8 text-center text-sm text-gray-600">
        <p>© 2025 CiteXai. All rights reserved. Verify citations. Stay honest.</p>
      </div>
    </footer>
  );
}
