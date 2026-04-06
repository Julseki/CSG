export default function Navbar() {
    return (
        <nav className="fixed top-0 w-full z-50 transition-all duration-300 bg-white/90 backdrop-blur-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6">
                <div className="flex justify-between items-center h-12 sm:h-14 md:h-16">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <img
                            src="/logo.png"
                            alt="Northern Mindanao Colleges, Inc."
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-contain object-center"
                        />
                        <span className="text-sm sm:text-base font-semibold text-green-800 whitespace-nowrap font-[Inter,sans-serif]">
                            Northern Mindanao Colleges, Inc.
                        </span>
                    </div>
                </div>
            </div>
        </nav>
    );
}