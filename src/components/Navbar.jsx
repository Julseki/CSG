export default function Navbar() {
    return (
        <nav className="fixed top-0 w-full z-50 transition-all duration-300 bg-white/90 backdrop-blur-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-14 sm:h-16 md:h-20">
                    <div className="flex items-center gap-3">
                        <img
                            src="/logo.png"
                            alt="Northern Mindanao Colleges, Inc."
                            className="w-9 h-9 rounded-full object-contain"
                        />
                        <span className="text-sm sm:text-base font-semibold text-green-800 whitespace-nowrap">
                            Northern Mindanao Colleges, Inc.
                        </span>
                    </div>

                    <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full border border-green-500 px-3 py-1.5 text-xs sm:text-sm font-medium text-green-700 hover:bg-green-50 transition-colors"
                    >
                        <span className="w-4 h-4 rounded-full border-2 border-green-600 border-dashed animate-spin-slow" />
                        <span>Settings</span>
                    </button>
                </div>
            </div>
        </nav>
    );
}