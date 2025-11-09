export function Hero({ 
  citation, 
  onCitationChange, 
  onVerify, 
  onFix, 
  onPdfUpload,
  isChecking, 
  isFixing, 
  isUploading 
}) {
  return (
    <section className="pt-32 pb-20 px-6 min-h-screen flex flex-col justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#565b96]/5 via-transparent to-transparent -z-10"></div>
      
      <div className="max-w-6xl mx-auto w-full">
        <h1 className="text-7xl md:text-8xl font-bold leading-tight mb-8 max-w-5xl">
          Your Citations<br/>
          <span className="text-[#565b96]">Always Honest</span>
        </h1>

        <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mb-12 leading-relaxed font-medium">
          Verify citations against 200M+ academic papers instantly. Fix broken citations with AI. Never cite a fake paper again.
        </p>

        <div className="max-w-3xl">
          <textarea
            value={citation}
            onChange={(e) => onCitationChange(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && onVerify()}
            placeholder="Paste your citation, DOI, or title here..."
            className="w-full h-28 p-6 bg-white border-2 border-gray-200 rounded-xl focus:border-[#565b96] focus:outline-none text-base resize-none placeholder-gray-400 transition"
          />

          <div className="flex gap-3 mt-6">
            <button
              onClick={onVerify}
              disabled={isChecking}
              className="flex-1 bg-[#565b96] hover:bg-[#484d7a] disabled:opacity-50 text-white font-semibold py-4 rounded-xl transition"
            >
              {isChecking ? 'Verifying...' : 'Verify Citation'}
            </button>

            <button
              onClick={onFix}
              disabled={isFixing}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-4 rounded-xl transition"
            >
              {isFixing ? 'Fixing...' : 'AI Fix'}
            </button>

            <label className="flex-1 bg-blue-600 hover:bg-blue-700 cursor-pointer text-white font-semibold py-4 rounded-xl transition flex items-center justify-center">
              <input type="file" accept=".pdf" onChange={onPdfUpload} className="hidden" />
              {isUploading ? 'Uploading...' : 'Upload PDF'}
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}
