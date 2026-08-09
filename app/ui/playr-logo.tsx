"use client"

export default function PlayrLogo() {
  return (
    <div className="flex items-center justify-center gap-2.5 mb-1">
      <svg width="34" height="34" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="36" height="36" rx="10" fill="url(#logo-grad)" />
        <path d="M13 10.5L24 18L13 25.5V10.5Z" fill="white" />
        <defs>
          <linearGradient id="logo-grad" x1="0" y1="0" x2="36" y2="36">
            <stop stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#6366f1" />
          </linearGradient>
        </defs>
      </svg>
      <span className="text-2xl font-bold tracking-tight text-white">Playr</span>
    </div>
  )
}
