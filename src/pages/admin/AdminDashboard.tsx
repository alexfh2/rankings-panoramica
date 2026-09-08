import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar, Users, FileText, ArrowRight } from 'lucide-react';

const AdminDashboard = () => {
  const navigate = useNavigate();

  const { data: seasonCount } = useQuery({
    queryKey: ['admin-seasons-count'],
    queryFn: async () => {
      const { count } = await supabase.from('seasons').select('*', { count: 'exact', head: true });
      return count ?? 0;
    },
  });

  const { data: roundCount } = useQuery({
    queryKey: ['admin-rounds-count'],
    queryFn: async () => {
      const { count } = await supabase.from('rounds').select('*', { count: 'exact', head: true });
      return count ?? 0;
    },
  });

  const { data: playerCount } = useQuery({
    queryKey: ['admin-players-count'],
    queryFn: async () => {
      const { count } = await supabase.from('players').select('*', { count: 'exact', head: true });
      return count ?? 0;
    },
  });

  const { data: newsStats } = useQuery({
    queryKey: ['admin-news-stats'],
    queryFn: async () => {
      const { data } = await supabase.from('news_drafts').select('status');
      const drafts = data?.filter(n => n.status === 'draft').length ?? 0;
      const published = data?.filter(n => n.status === 'published').length ?? 0;
      return { total: (data?.length ?? 0), drafts, published };
    },
  });

  const stats = [
    { label: 'Temporadas', value: seasonCount ?? 0, icon: Trophy, path: '/admin/temporades' },
    { label: 'Jornadas', value: roundCount ?? 0, icon: Calendar, path: '/admin/jornades' },
    { label: 'Jugadores', value: playerCount ?? 0, icon: Users, path: '/admin/jugadors' },
    { label: 'Noticias', value: newsStats?.total ?? 0, icon: FileText, path: '/admin/noticies', extra: newsStats },
  ];

  return (
    <div className="animate-fade-in">
      <p className="admin-eyebrow mb-2">Panel de gestión</p>
      <h1 className="admin-page-title mb-8">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="admin-metric-card cursor-pointer transition-all group"
            onClick={() => navigate(stat.path)}
          >
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="admin-card-label">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 transition-colors" style={{ color: '#D08D69' }} />
            </CardHeader>
            <CardContent>
              <p className="admin-figure">{stat.value}</p>
              {stat.extra && (
                <div className="flex gap-2 mt-2">
                  <Badge variant="secondary" className="admin-pill-draft">
                    {stat.extra.drafts} {stat.extra.drafts === 1 ? 'borrador' : 'borradores'}
                  </Badge>
                  <Badge variant="default" className="admin-pill-published">
                    {stat.extra.published} {stat.extra.published === 1 ? 'publicada' : 'publicadas'}
                  </Badge>
                </div>
              )}
              <div className="mt-4">
                <span className="admin-text-link inline-flex items-center gap-1">
                  Gestionar <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
