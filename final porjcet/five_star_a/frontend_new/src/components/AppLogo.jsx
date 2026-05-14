export default function AppLogo({ className = '', alt = '5A logo' }) {
    return (
        <span
            role="img"
            aria-label={alt}
            className={`app-logo ${className}`.trim()}
            draggable="false"
        >
            <svg viewBox="0 0 100 100" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <text x="50%" y="55%" textAnchor="middle" dominantBaseline="middle" className="logo-symbol">5A</text>
            </svg>
        </span>
    )
}
