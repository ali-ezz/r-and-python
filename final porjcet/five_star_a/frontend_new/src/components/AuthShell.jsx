import AppLogo from './AppLogo'

export default function AuthShell({
    eyebrow,
    title,
    subtitle,
    footer,
    children,
}) {
    return (
        <div className="auth-shell">
            <div className="auth-backdrop-grid" />
            <div className="auth-orb auth-orb-a" />
            <div className="auth-orb auth-orb-b" />
            <div className="auth-orb auth-orb-c" />

            <div className="auth-layout animate-fade-in-up">
                <section className="auth-copy">
                    <p className="auth-kicker">Task Management</p>
                    <h1 className="auth-title">Quiet focus. Clear workflow. Better follow-through.</h1>
                    <p className="auth-subtitle">
                        A warmer, calmer workspace with faster startup, cleaner task flow, and live backend connection.
                    </p>

                    <div className="auth-feature-list">
                        <div className="auth-feature-card">
                            <span className="auth-feature-dot" />
                            <div>
                                <p className="auth-feature-title">Connected live</p>
                                <p className="auth-feature-text">Auth, tasks, projects, search, and exports stay linked to the FastAPI backend.</p>
                            </div>
                        </div>
                        <div className="auth-feature-card">
                            <span className="auth-feature-dot" />
                            <div>
                                <p className="auth-feature-title">Softer visuals</p>
                                <p className="auth-feature-text">Warm light surfaces and true dark neutrals without the previous blue tint.</p>
                            </div>
                        </div>
                        <div className="auth-feature-card">
                            <span className="auth-feature-dot" />
                            <div>
                                <p className="auth-feature-title">Faster interactions</p>
                                <p className="auth-feature-text">Refined hover motion, startup polish, and smoother entry transitions across the app.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="auth-card glass-card">
                    <div className="auth-card-header">
                        <div className="auth-brand-badge">
                            <AppLogo className="auth-logo-image" alt="5*A app logo" />
                        </div>
                        <div>
                            <p className="auth-card-eyebrow">{eyebrow}</p>
                            <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
                            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
                        </div>
                    </div>

                    {children}

                    {footer}
                </section>
            </div>
        </div>
    )
}
