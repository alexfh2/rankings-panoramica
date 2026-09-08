import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  LayoutDashboard,
  Calendar,
  Trophy,
  LogOut,
  ChevronLeft,
  ChevronDown,
  Users,
  FileText,
  Tag,
} from 'lucide-react';
import logoAsset from '@/assets/logo-panoramica-crema.png.asset.json';

type NavLinkItem = {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  end: boolean;
};

const competitionRoutes = ['/admin/temporades', '/admin/jornades', '/admin/jugadors'];

const competitionLinks: NavLinkItem[] = [
  { path: '/admin/temporades', label: 'Temporadas', icon: Trophy, end: false },
  { path: '/admin/jornades', label: 'Jornadas', icon: Calendar, end: false },
  { path: '/admin/jugadors', label: 'Jugadores', icon: Users, end: false },
];

const mainLinks: NavLinkItem[] = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { path: '/admin/tarifas', label: 'Tarifas', icon: Tag, end: false },
  { path: '/admin/actualidad', label: 'Actualidad', icon: FileText, end: false },
  { path: '/admin/admins', label: 'Administradores', icon: Users, end: false },
];

const isCompetitionActive = (pathname: string) =>
  competitionRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

const linkClassName = ({ isActive }: { isActive: boolean }) =>
  `admin-nav-link flex items-center gap-3 px-3 py-2.5 transition-colors ${
    isActive ? 'admin-nav-active' : ''
  }`;

const AdminLayout = () => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [competitionOpen, setCompetitionOpen] = useState(() =>
    isCompetitionActive(pathname)
  );

  const competitionActive = isCompetitionActive(pathname);

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  return (
    <div className="admin-shell flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r">
        <div className="p-4 border-b">
          <div>
            <img
              src={logoAsset.url}
              alt="Panorámica Golf, Sports & Resort"
              className="h-10 w-auto"
            />
          </div>
          <p className="text-xs truncate mt-2" style={{ color: 'rgba(243,238,227,0.62)' }}>
            {user?.email}
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {mainLinks.map((link) => (
            <div key={link.path} className="space-y-1">
              {link.label === 'Tarifas' && (
                <Collapsible
                  open={competitionOpen}
                  onOpenChange={setCompetitionOpen}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className={`admin-nav-link flex w-full items-center gap-3 px-3 py-2.5 transition-colors ${
                        competitionActive ? 'admin-nav-active' : ''
                      }`}
                    >
                      <Trophy className="h-4 w-4" />
                      Competición
                      <ChevronDown
                        className={`h-4 w-4 ml-auto transition-transform ${
                          competitionOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-1 ml-3 pl-3 border-l border-primary-foreground/10 space-y-1">
                      {competitionLinks.map((sub) => (
                        <NavLink
                          key={sub.path}
                          to={sub.path}
                          end={sub.end}
                          className={linkClassName}
                        >
                          <sub.icon className="h-4 w-4" />
                          {sub.label}
                        </NavLink>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
              <NavLink
                to={link.path}
                end={link.end}
                className={linkClassName}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </NavLink>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-primary-foreground/10 space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => navigate('/')}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Volver al sitio
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="admin-mobile-bar md:hidden fixed top-0 left-0 right-0 z-50 border-b p-3 flex items-center gap-1 flex-wrap">
        <img
          src={logoAsset.url}
          alt="Panorámica Golf, Sports & Resort"
          className="h-7 w-auto mr-2"
        />
        {mainLinks.map((link) => (
          <div key={link.path} className="relative">
            {link.label === 'Tarifas' && (
              <Collapsible
                open={competitionOpen}
                onOpenChange={setCompetitionOpen}
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className={`relative p-2 rounded-md ${
                      competitionActive
                        ? 'bg-primary-foreground/15'
                        : 'text-primary-foreground/70'
                    }`}
                    aria-label="Competición"
                  >
                    <Trophy className="h-4 w-4" />
                    <ChevronDown
                      className={`h-3 w-3 absolute -bottom-0.5 -right-0.5 transition-transform ${
                        competitionOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="absolute top-full left-0 mt-1 flex gap-1 bg-primary p-2 rounded-md border border-primary-foreground/10 z-50">
                    {competitionLinks.map((sub) => (
                      <NavLink
                        key={sub.path}
                        to={sub.path}
                        end={sub.end}
                        className={({ isActive }) =>
                          `p-2 rounded-md ${isActive ? 'bg-primary-foreground/15' : 'text-primary-foreground/70'}`
                        }
                        aria-label={sub.label}
                      >
                        <sub.icon className="h-4 w-4" />
                      </NavLink>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
            <NavLink
              to={link.path}
              end={link.end}
              className={({ isActive }) =>
                `p-2 rounded-md ${isActive ? 'bg-primary-foreground/15' : 'text-primary-foreground/70'}`
              }
              aria-label={link.label}
            >
              <link.icon className="h-4 w-4" />
            </NavLink>
          </div>
        ))}
        <Button variant="ghost" size="icon" className="text-primary-foreground/70 h-8 w-8" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      {/* Main content */}
      <main className="flex-1 md:pt-0 pt-14">
        <div className="p-6 lg:p-8 max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
