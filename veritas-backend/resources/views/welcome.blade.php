<!DOCTYPE html>
<html lang="sq">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Veritas - Detektimi i Lajmeve të Rreme</title>
    <!-- Tailwind CSS CDN për dizajn modern -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
    </style>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen flex flex-col justify-between">

    <!-- Header / Navbar -->
    <header class="border-b border-slate-800 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
        <div class="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
            <div class="flex items-center space-x-3">
                <div class="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">V</div>
                <span class="text-xl font-bold tracking-tight text-white">Veritas <span class="text-indigo-400 text-xs font-semibold uppercase px-2 py-0.5 bg-indigo-950 border border-indigo-800 rounded-full">NLP v1.0</span></span>
            </div>
            <span class="text-sm text-slate-400">Java 4 — NLP Analysis</span>
        </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-4xl mx-auto px-6 py-12 w-full flex-grow">
        
        <!-- Hero Title -->
        <div class="text-center mb-10">
            <h1 class="text-4xl font-extrabold text-white mb-3 tracking-tight">Analizo Artikujt për Lajme të Rreme</h1>
            <p class="text-slate-400 text-lg max-w-xl mx-auto">Shkruaj ose ngjit tekstin e artikullit për të ekzekutuar përpunimin e gjuhës natyrore (NLP), nxjerrjen e fjalëve kyçe dhe verifikimin e përmbajtjes.</p>
        </div>

        <!-- Input Form -->
        <div class="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 shadow-xl mb-8">
            <form id="news-form" class="space-y-4">
                <div>
                    <label for="content-input" class="block text-sm font-medium text-slate-300 mb-2">Teksti i Artikullit ose URL</label>
                    <textarea id="content-input" rows="6" required class="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-sm" placeholder="Ngjit këtu tekstin e lajmit që dëshiron të analizosh..."></textarea>
                </div>
                <button type="submit" id="submit-btn" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3.5 px-6 rounded-xl shadow-lg shadow-indigo-600/20 transition duration-200 flex items-center justify-center space-x-2">
                    <span id="btn-text">Analizo Përmbajtjen (NLP)</span>
                    <span id="btn-spinner" class="hidden">
                        <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </span>
                </button>
            </form>
        </div>

        <!-- Results Section (E fshehur fillimisht) -->
        <div id="results-section" class="hidden space-y-6">
            
            <div class="border-t border-slate-800 pt-8">
                <h2 class="text-xl font-bold text-white mb-4 flex items-center space-x-2">
                    <span>Rezultatet e Analizës NLP</span>
                </h2>

                <!-- Metrikat Kryesore -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div class="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
                        <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Statusi i Besueshmërisë</span>
                        <span id="verdict-tag" class="text-lg font-bold text-emerald-400">Përfunduar</span>
                    </div>
                    <div class="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
                        <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Numri i Fjalëve</span>
                        <span id="words-count" class="text-2xl font-bold text-white">0</span>
                    </div>
                    <div class="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
                        <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Numri i Fjalive</span>
                        <span id="sentences-count" class="text-2xl font-bold text-white">0</span>
                    </div>
                </div>

                <!-- Top Fjalët Kyçe (Keywords) -->
                <div class="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 mb-6">
                    <h3 class="text-sm font-semibold text-slate-300 mb-3">Top Fjalët Kyçe të Nxjerrura (Keywords)</h3>
                    <div id="keywords-list" class="flex flex-wrap gap-2">
                        <!-- Do të mbushen me JS -->
                    </div>
                </div>

                <!-- JSON Response Raw Display -->
                <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto">
                    <span class="text-xs font-mono text-slate-500 uppercase block mb-2">// Përgjigja Zyrtare nga Backend-i (JSON API)</span>
                    <pre id="json-output" class="text-xs font-mono text-indigo-300 whitespace-pre-wrap"></pre>
                </div>
            </div>

        </div>

    </main>

    <!-- Footer -->
    <footer class="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        &copy; 2026 Veritas Backend — Zhvilluar nga Erblin
    </footer>

    <!-- LOGJIKA E FRONTEND-IT (JS) -->
    <script>
        document.getElementById('news-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const content = document.getElementById('content-input').value;
            const submitBtn = document.getElementById('submit-btn');
            const btnText = document.getElementById('btn-text');
            const btnSpinner = document.getElementById('btn-spinner');
            const resultsSection = document.getElementById('results-section');
            
            // Shfaq loading state
            btnText.textContent = 'Duke analizuar...';
            btnSpinner.classList.remove('hidden');
            submitBtn.disabled = true;

            try {
                // Thirrja e API-së së Laravel Backend-it tonë
                const response = await fetch('/api/v1/analyze', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ content: content })
                });

                const data = await response.json();

                // Shfaqja e rezultateve në ndërfaqe
                document.getElementById('json-output').textContent = JSON.stringify(data, null, 2);
                
                if (data.nlp_analysis) {
                    document.getElementById('words-count').textContent = data.nlp_analysis.total_words || 0;
                    document.getElementById('sentences-count').textContent = data.nlp_analysis.sentences_count || 0;
                    
                    const keywordsContainer = document.getElementById('keywords-list');
                    keywordsContainer.innerHTML = '';
                    
                    if (data.nlp_analysis.extracted_keywords && data.nlp_analysis.extracted_keywords.length > 0) {
                        data.nlp_analysis.extracted_keywords.forEach(word => {
                            const badge = document.createElement('span');
                            badge.className = 'px-3 py-1 bg-indigo-950 border border-indigo-800 text-indigo-300 text-xs font-medium rounded-lg';
                            badge.textContent = word;
                            keywordsContainer.appendChild(badge);
                        });
                    } else {
                        keywordsContainer.innerHTML = '<span class="text-slate-500 text-xs">Nuk u gjetën fjalë kyçe.</span>';
                    }
                }

                resultsSection.classList.remove('hidden');

            } catch (error) {
                alert('Pati një gabim gjatë lidhjes me API-në: ' + error.message);
            } finally {
                // Kthe butonin në gjendje normale
                btnText.textContent = 'Analizo Përmbajtjen (NLP)';
                btnSpinner.classList.add('hidden');
                submitBtn.disabled = false;
            }
        });
    </script>
</body>
</html>