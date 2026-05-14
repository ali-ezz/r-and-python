import AppLogo from './AppLogo'

export default function AppStartup({ label = 'Loading your workspace' }) {
    return (
        <div className="startup-screen">
            <div className="startup-orb startup-orb-left" />
            <div className="startup-orb startup-orb-right" />
            <div className="startup-panel animate-fade-in-up">
                <div className="startup-logo-wrap">
                    <AppLogo className="startup-logo-image" alt="5A app logo" />
                </div>
                <div className="text-center space-y-2">
                    <p className="startup-kicker">Task Workspace</p>
                    <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Preparing your dashboard</h1>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</p>
                </div>
                <div className="startup-progress" aria-hidden="true">
                    <span />
                </div>
            </div>
        </div>
    )
}
