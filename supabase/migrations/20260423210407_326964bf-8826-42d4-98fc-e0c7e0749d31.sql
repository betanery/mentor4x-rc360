
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM (
  'super_admin', 'mentor', 'estrategista',
  'cliente_dono', 'gestor_cliente', 'colaborador_cliente'
);

CREATE TYPE public.chaos_level AS ENUM ('total','severo','moderado','leve','escala');
CREATE TYPE public.journey_stage AS ENUM ('mes_1','mes_2','mes_3','mes_4','concluido');
CREATE TYPE public.goal_status AS ENUM ('nao_iniciado','em_andamento','concluido','atrasado','bloqueado');
CREATE TYPE public.pillar AS ENUM ('crescimento','eficiencia','encantamento','lideranca');
CREATE TYPE public.bottleneck_urgency AS ENUM ('baixa','media','alta','critica');
CREATE TYPE public.meeting_type AS ENUM ('sala_guerra','mentoria','estrategia','kickoff','review');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  job_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('super_admin','mentor','estrategista')
  )
$$;

-- ============ COMPANIES ============
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  segment TEXT,
  logo_url TEXT,
  journey_stage journey_stage NOT NULL DEFAULT 'mes_1',
  chaos_level chaos_level NOT NULL DEFAULT 'moderado',
  overall_score INTEGER NOT NULL DEFAULT 0,
  owner_dependency INTEGER NOT NULL DEFAULT 70,
  projected_revenue NUMERIC(14,2) DEFAULT 0,
  started_at DATE DEFAULT CURRENT_DATE,
  expected_completion DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- ============ COMPANY MEMBERS ============
CREATE TABLE public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_role app_role NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_company_member(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE user_id = _user_id AND company_id = _company_id
  )
$$;

CREATE OR REPLACE FUNCTION public.user_companies(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT company_id FROM public.company_members WHERE user_id = _user_id
$$;

-- ============ GOALS ============
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  pillar pillar,
  responsible_user_id UUID REFERENCES auth.users(id),
  due_date DATE,
  indicator TEXT,
  financial_impact NUMERIC(14,2) DEFAULT 0,
  status goal_status NOT NULL DEFAULT 'nao_iniciado',
  evidence_url TEXT,
  mentor_comment TEXT,
  week_start DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.goal_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.goal_updates ENABLE ROW LEVEL SECURITY;

-- ============ BOTTLENECKS ============
CREATE TABLE public.bottlenecks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  area TEXT,
  impact TEXT,
  urgency bottleneck_urgency NOT NULL DEFAULT 'media',
  estimated_value NUMERIC(14,2) DEFAULT 0,
  correction_plan TEXT,
  responsible_user_id UUID REFERENCES auth.users(id),
  progress INTEGER NOT NULL DEFAULT 0,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bottlenecks ENABLE ROW LEVEL SECURITY;

-- ============ PILLAR SCORES ============
CREATE TABLE public.pillar_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  pillar pillar NOT NULL,
  score INTEGER NOT NULL,
  blind_spots TEXT,
  recommendations TEXT,
  measured_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pillar_scores ENABLE ROW LEVEL SECURITY;

-- ============ WEEKLY REVIEWS (Sala de Guerra) ============
CREATE TABLE public.weekly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  done TEXT,
  blocked TEXT,
  indicators TEXT,
  next_steps TEXT,
  decisions TEXT,
  ai_summary TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, week_start)
);
ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY;

-- ============ MEETINGS ============
CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  meeting_type meeting_type NOT NULL DEFAULT 'mentoria',
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_min INTEGER DEFAULT 60,
  location TEXT,
  meeting_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;

-- ============ TASKS ============
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  responsible_user_id UUID REFERENCES auth.users(id),
  due_date DATE,
  done BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- ============ UNIVERSIDADE 4X ============
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  cover_url TEXT,
  order_index INTEGER DEFAULT 0,
  published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  pdf_url TEXT,
  duration_min INTEGER DEFAULT 0,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  progress_pct INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, user_id)
);
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;

-- ============ REPORTS, NOTIFICATIONS, AI, CERTIFICATES ============
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  pdf_url TEXT,
  summary JSONB,
  generated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ai_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  prompt TEXT,
  response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pdf_url TEXT,
  code TEXT UNIQUE
);
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_goals_updated BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bottlenecks_updated BEFORE UPDATE ON public.bottlenecks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_weekly_reviews_updated BEFORE UPDATE ON public.weekly_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lesson_progress_updated BEFORE UPDATE ON public.lesson_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============

-- profiles: each user sees own; staff sees all
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- user_roles: users see own; only super_admin manages
CREATE POLICY "roles_self_view" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "roles_admin_all" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- companies: members see their company; staff sees all; only staff modifies
CREATE POLICY "companies_select" ON public.companies FOR SELECT USING (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), id));
CREATE POLICY "companies_staff_modify" ON public.companies FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- company_members
CREATE POLICY "members_select" ON public.company_members FOR SELECT USING (public.is_staff(auth.uid()) OR user_id = auth.uid() OR public.is_company_member(auth.uid(), company_id));
CREATE POLICY "members_staff_modify" ON public.company_members FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Generic policy generator pattern: company-scoped tables
-- goals
CREATE POLICY "goals_select" ON public.goals FOR SELECT USING (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id));
CREATE POLICY "goals_modify" ON public.goals FOR ALL USING (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id)) WITH CHECK (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id));

-- goal_updates
CREATE POLICY "goal_updates_select" ON public.goal_updates FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), g.company_id)))
);
CREATE POLICY "goal_updates_insert" ON public.goal_updates FOR INSERT WITH CHECK (
  author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), g.company_id)))
);

-- bottlenecks
CREATE POLICY "bottlenecks_select" ON public.bottlenecks FOR SELECT USING (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id));
CREATE POLICY "bottlenecks_modify" ON public.bottlenecks FOR ALL USING (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id)) WITH CHECK (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id));

-- pillar_scores
CREATE POLICY "pillar_select" ON public.pillar_scores FOR SELECT USING (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id));
CREATE POLICY "pillar_modify" ON public.pillar_scores FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- weekly_reviews
CREATE POLICY "wr_select" ON public.weekly_reviews FOR SELECT USING (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id));
CREATE POLICY "wr_modify" ON public.weekly_reviews FOR ALL USING (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id)) WITH CHECK (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id));

-- meetings
CREATE POLICY "meetings_select" ON public.meetings FOR SELECT USING (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id));
CREATE POLICY "meetings_modify" ON public.meetings FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- meeting_notes (private notes only visible to staff)
CREATE POLICY "mn_select" ON public.meeting_notes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.meetings m WHERE m.id = meeting_id AND (
      public.is_staff(auth.uid()) OR (NOT is_private AND public.is_company_member(auth.uid(), m.company_id))
    )
  )
);
CREATE POLICY "mn_insert" ON public.meeting_notes FOR INSERT WITH CHECK (
  author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_id AND (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), m.company_id)))
);

-- tasks
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT USING (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id));
CREATE POLICY "tasks_modify" ON public.tasks FOR ALL USING (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id)) WITH CHECK (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id));

-- courses & lessons: all authenticated can read; staff manages
CREATE POLICY "courses_select_auth" ON public.courses FOR SELECT TO authenticated USING (published OR public.is_staff(auth.uid()));
CREATE POLICY "courses_staff_modify" ON public.courses FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "lessons_select_auth" ON public.lessons FOR SELECT TO authenticated USING (true);
CREATE POLICY "lessons_staff_modify" ON public.lessons FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "lp_self_all" ON public.lesson_progress FOR ALL USING (auth.uid() = user_id OR public.is_staff(auth.uid())) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "playbooks_select_auth" ON public.playbooks FOR SELECT TO authenticated USING (true);
CREATE POLICY "playbooks_staff_modify" ON public.playbooks FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- reports
CREATE POLICY "reports_select" ON public.reports FOR SELECT USING (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id));
CREATE POLICY "reports_staff_modify" ON public.reports FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- notifications
CREATE POLICY "notif_self_select" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif_self_update" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notif_staff_insert" ON public.notifications FOR INSERT WITH CHECK (public.is_staff(auth.uid()) OR auth.uid() = user_id);

-- ai_logs
CREATE POLICY "ai_select" ON public.ai_logs FOR SELECT USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "ai_insert" ON public.ai_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- certificates
CREATE POLICY "cert_select" ON public.certificates FOR SELECT USING (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id));
CREATE POLICY "cert_staff_modify" ON public.certificates FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ INDEXES ============
CREATE INDEX idx_goals_company ON public.goals(company_id);
CREATE INDEX idx_goals_status ON public.goals(status);
CREATE INDEX idx_goals_due ON public.goals(due_date);
CREATE INDEX idx_bottlenecks_company ON public.bottlenecks(company_id);
CREATE INDEX idx_pillar_company ON public.pillar_scores(company_id);
CREATE INDEX idx_meetings_company ON public.meetings(company_id);
CREATE INDEX idx_wr_company ON public.weekly_reviews(company_id);
CREATE INDEX idx_members_user ON public.company_members(user_id);
CREATE INDEX idx_members_company ON public.company_members(company_id);
CREATE INDEX idx_notif_user ON public.notifications(user_id, read);

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars','avatars', true),
  ('evidences','evidences', false),
  ('reports','reports', false),
  ('lessons','lessons', false)
ON CONFLICT (id) DO NOTHING;

-- avatars public read; user uploads own
CREATE POLICY "avatars_read" ON storage.objects FOR SELECT USING (bucket_id='avatars');
CREATE POLICY "avatars_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id='avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE USING (bucket_id='avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- evidences: company-scoped (folder = company_id)
CREATE POLICY "evidences_read" ON storage.objects FOR SELECT USING (
  bucket_id='evidences' AND (
    public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);
CREATE POLICY "evidences_upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id='evidences' AND (
    public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

-- reports & lessons: staff write, members of company read reports, all auth read lessons
CREATE POLICY "reports_read" ON storage.objects FOR SELECT USING (
  bucket_id='reports' AND (
    public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);
CREATE POLICY "reports_write_staff" ON storage.objects FOR INSERT WITH CHECK (bucket_id='reports' AND public.is_staff(auth.uid()));

CREATE POLICY "lessons_read_auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='lessons');
CREATE POLICY "lessons_write_staff" ON storage.objects FOR INSERT WITH CHECK (bucket_id='lessons' AND public.is_staff(auth.uid()));
