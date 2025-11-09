export function Stats() {
  return (
    <section className="py-20 px-6 bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <p className="text-5xl font-bold text-[#565b96]">200M+</p>
            <p className="text-gray-600 mt-3 font-medium">Academic Papers</p>
          </div>
          <div>
            <p className="text-5xl font-bold text-[#565b96]">99.9%</p>
            <p className="text-gray-600 mt-3 font-medium">Accuracy Rate</p>
          </div>
          <div>
            <p className="text-5xl font-bold text-[#565b96]">2s</p>
            <p className="text-gray-600 mt-3 font-medium">Response Time</p>
          </div>
          <div>
            <p className="text-5xl font-bold text-[#565b96]">4</p>
            <p className="text-gray-600 mt-3 font-medium">Database Sources</p>
          </div>
        </div>
      </div>
    </section>
  );
}
