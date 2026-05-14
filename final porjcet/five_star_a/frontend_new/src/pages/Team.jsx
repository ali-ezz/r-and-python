import { Users, Briefcase, Code, Palette, Search, Shield, Database, Layout, TestTube, Rocket } from 'lucide-react'

const teamMembers = [
  { name: 'Ahmed Abobakr Hanafi', role: 'Project Manager / System Architect', desc: 'Overall supervision, architecture, code review, team coordination', icon: Briefcase },
  { name: 'Ali Ez Alyan', role: 'Backend Lead Developer', desc: 'API development, database, security, performance', icon: Code },
  { name: 'Ahmed Sabry Hamza', role: 'Frontend Developer', desc: 'UI development, UX design, animations, theming', icon: Palette },
  { name: 'Ahmed Abdul-Nasser Sayed', role: 'API Integration Specialist', desc: 'Search sources integration, data processing, optimization', icon: Search },
  { name: 'Ahmed Mohamed Mohamed', role: 'QA Engineer & Documentation', desc: 'Testing, code review, documentation, quality assurance', icon: TestTube },
]

const projectAreas = [
  { icon: Database, name: 'Backend Core', desc: 'FastAPI, SQLAlchemy, PostgreSQL, 100+ endpoints' },
  { icon: Layout, name: 'Frontend & Views', desc: 'React, 8 view engines, real-time updates' },
  { icon: Shield, name: 'Security & Auth', desc: 'JWT, 2FA, OAuth, role-based access' },
  { icon: Search, name: 'Search Engine', desc: '20+ API sources, AI-powered, privacy-focused' },
  { icon: Code, name: 'API Architecture', desc: 'REST, WebSocket, rate limiting, error handling' },
  { icon: Rocket, name: 'Deployment', desc: 'Docker, CI/CD, monitoring, scaling' },
]

export default function Team() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Team</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>5*A Project — Team & Overview</p>
      </div>

      {/* Team Members */}
      <div className="glass-card p-6">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Users className="w-4 h-4" /> Team Members
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {teamMembers.map((member, i) => (
            <div key={i} className="p-4 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-gradient)' }}>
                  <member.icon className="w-4 h-4" style={{ color: 'var(--bg-deepest)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{member.name}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{member.role}</p>
                </div>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{member.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Project Areas */}
      <div className="glass-card p-6">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Briefcase className="w-4 h-4" /> Project Areas
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {projectAreas.map((area, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
              <area.icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent-solid)' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{area.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{area.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
