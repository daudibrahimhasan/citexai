# CiteXai - AI-Powered Citation Verification

<div align="center">
  <h3>Stop Citing Fake Papers. Verify with Confidence.</h3>
  <p>Verify citations instantly against 200M+ real academic papers from CrossRef, OpenAlex, Google Books, and Semantic Scholar.</p>

[![Next.js](https://img.shields.io/badge/Next.js-16.0-black)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38bdf8)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ecf8e)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

---

## 🚀 Features

- **Instant Verification**: Checks citations against massive academic databases (CrossRef, OpenAlex, Semantic Scholar, Google Books) to confirm existence and accuracy.
- **Fake Citation Detection**: Specifically designed to catch AI-hallucinated citations (from ChatGPT, Claude, etc.) and broken DOIs.
- **Smart AI Fixer**: Automatically suggests corrections for broken or incomplete citations.
- **PDF Extraction**: Upload a PDF research paper to automatically extract and verify all contained citations.
- **Multi-Format Support**: Convert citations between APA, MLA, Chicago, Harvard, and more.
- **User Accounts**: Track verification history and usage limits (integrated with Google Sign-In).

## 🛠️ Technology Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) & Vanilla CSS
- **Authentication**: [NextAuth.js](https://next-auth.js.org/)
- **Database**: [Supabase](https://supabase.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **External APIs**: CrossRef, OpenAlex, Semantic Scholar, Google Books

## 📦 Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/daudibrahimhasan/citexai.git
    cd citexai
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Copy the example environment file and fill in your credentials.

    ```bash
    cp .env.example .env.local
    ```

    You will need to set up:

    - **Supabase**: URL and Service Role Key.
    - **Google OAuth**: Client ID and Secret (for authentication).
    - **NextAuth**: Secret and URL.

4.  **Run the development server:**

    ```bash
    npm run dev
    ```

    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🏗️ Build & Deployment

To create a production build:

```bash
npm run build
```

To start the production server:

```bash
npm run start
```

## 📂 Project Structure

```
p:\citexai\
├── app\                    # Next.js App Router source
│   ├── api\                # API Routes (Serverless)
│   ├── components\         # React Components
│   ├── lib\                # Utility libraries (validators, API clients)
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Main landing page & application
├── public\                 # Static assets
└── ...config files
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1.  Fork the project
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Contact

**Daud Ibrahim Hasan** - [LinkedIn](https://www.linkedin.com/in/daudibrahimhasan/)

Project Link: [https://github.com/daudibrahimhasan/citexai](https://github.com/daudibrahimhasan/citexai)
