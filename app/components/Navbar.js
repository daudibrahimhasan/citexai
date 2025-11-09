export function Navbar({ historyCount, onHistoryClick }) {
  return (
    <nav className="fixed top-0 w-full bg-[#f6f4f1]/95 backdrop-blur-sm z-50 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 bg-[#565b96] rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-lg">C</span>
          </div>
          <span className="font-semibold text-lg">CiteXai</span>
        </div>
        <button 
          onClick={onHistoryClick}
          className="px-4 py-2 text-sm font-medium text-[#565b96] hover:bg-gray-100 rounded-lg transition"
        >
          History ({historyCount})
        </button>
      </div>
    </nav>
  );
}
