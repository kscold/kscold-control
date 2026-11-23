-- 처음 설치하는 빈 데이터베이스에 기본 테이블을 만든다.
-- 이 테이블들은 예전에는 TypeORM 자동 동기화로 만들어져 다른 마이그레이션에 없었다.
-- 운영 DB 구조(2026-11-23)를 그대로 옮겼고, 이미 있는 DB 에서는 아무것도 바꾸지 않도록 모두 존재 여부를 확인한다.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

CREATE TABLE IF NOT EXISTS public.containers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "dockerId" character varying NOT NULL,
    name character varying NOT NULL,
    image character varying NOT NULL,
    status character varying DEFAULT 'created'::character varying NOT NULL,
    ports jsonb NOT NULL,
    resources jsonb NOT NULL,
    environment jsonb,
    "userId" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "stoppedAt" timestamp without time zone
);

CREATE TABLE IF NOT EXISTS public.ip_bans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ip character varying(64) NOT NULL,
    reason text,
    source character varying(32) DEFAULT 'manual'::character varying NOT NULL,
    expires_at timestamp with time zone,
    active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.messages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "sessionId" uuid NOT NULL,
    role character varying NOT NULL,
    content text NOT NULL,
    metadata jsonb,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.permissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    description character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.repository_projects (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(500),
    "fileCount" integer DEFAULT 0 NOT NULL,
    "totalSize" bigint DEFAULT 0 NOT NULL,
    "ownerId" character varying(100),
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    "roleId" uuid NOT NULL,
    "permissionId" uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS public.roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    description character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "userId" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "lastActivityAt" timestamp without time zone
);

CREATE TABLE IF NOT EXISTS public.topology_node_layouts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    node_id character varying NOT NULL,
    x double precision NOT NULL,
    y double precision NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    "userId" uuid NOT NULL,
    "roleId" uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying NOT NULL,
    password character varying NOT NULL,
    "terminalCommandCount" integer DEFAULT 0 NOT NULL,
    "terminalCommandLimit" integer DEFAULT '-1'::integer NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PK_18325f38ae6de43878487eff986' AND conrelid = 'public.messages'::regclass) THEN
    ALTER TABLE ONLY public.messages
        ADD CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PK_21cbac3e68f7b1cf53d39cda70c' AND conrelid = 'public.containers'::regclass) THEN
    ALTER TABLE ONLY public.containers
        ADD CONSTRAINT "PK_21cbac3e68f7b1cf53d39cda70c" PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PK_3238ef96f18b355b671619111bc' AND conrelid = 'public.sessions'::regclass) THEN
    ALTER TABLE ONLY public.sessions
        ADD CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PK_88481b0c4ed9ada47e9fdd67475' AND conrelid = 'public.user_roles'::regclass) THEN
    ALTER TABLE ONLY public.user_roles
        ADD CONSTRAINT "PK_88481b0c4ed9ada47e9fdd67475" PRIMARY KEY ("userId", "roleId");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PK_920331560282b8bd21bb02290df' AND conrelid = 'public.permissions'::regclass) THEN
    ALTER TABLE ONLY public.permissions
        ADD CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PK_a3ffb1c0c8416b9fc6f907b7433' AND conrelid = 'public.users'::regclass) THEN
    ALTER TABLE ONLY public.users
        ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PK_c1433d71a4838793a49dcad46ab' AND conrelid = 'public.roles'::regclass) THEN
    ALTER TABLE ONLY public.roles
        ADD CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PK_d430a02aad006d8a70f3acd7d03' AND conrelid = 'public.role_permissions'::regclass) THEN
    ALTER TABLE ONLY public.role_permissions
        ADD CONSTRAINT "PK_d430a02aad006d8a70f3acd7d03" PRIMARY KEY ("roleId", "permissionId");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_48ce552495d14eae9b187bb6716' AND conrelid = 'public.permissions'::regclass) THEN
    ALTER TABLE ONLY public.permissions
        ADD CONSTRAINT "UQ_48ce552495d14eae9b187bb6716" UNIQUE (name);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_648e3f5447f725579d7d4ffdfb7' AND conrelid = 'public.roles'::regclass) THEN
    ALTER TABLE ONLY public.roles
        ADD CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE (name);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_8e9362aec22a1d650c9627e07de' AND conrelid = 'public.containers'::regclass) THEN
    ALTER TABLE ONLY public.containers
        ADD CONSTRAINT "UQ_8e9362aec22a1d650c9627e07de" UNIQUE ("dockerId");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_97672ac88f789774dd47f7c8be3' AND conrelid = 'public.users'::regclass) THEN
    ALTER TABLE ONLY public.users
        ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ip_bans_pkey' AND conrelid = 'public.ip_bans'::regclass) THEN
    ALTER TABLE ONLY public.ip_bans
        ADD CONSTRAINT ip_bans_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'repository_projects_pkey' AND conrelid = 'public.repository_projects'::regclass) THEN
    ALTER TABLE ONLY public.repository_projects
        ADD CONSTRAINT repository_projects_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'topology_node_layouts_pkey' AND conrelid = 'public.topology_node_layouts'::regclass) THEN
    ALTER TABLE ONLY public.topology_node_layouts
        ADD CONSTRAINT topology_node_layouts_pkey PRIMARY KEY (id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "IDX_06792d0c62ce6b0203c03643cd" ON public.role_permissions USING btree ("permissionId");

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_44652873a81b5c0fbe12802ee7" ON public.ip_bans USING btree (ip);

CREATE INDEX IF NOT EXISTS "IDX_472b25323af01488f1f66a06b6" ON public.user_roles USING btree ("userId");

CREATE INDEX IF NOT EXISTS "IDX_579909c54b8516bc2f2a90a9e0" ON public.repository_projects USING btree ("ownerId");

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_5adb0358ae293db64bde1489e7" ON public.repository_projects USING btree (name);

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_63af906221d31812d704305e17" ON public.topology_node_layouts USING btree (user_id, node_id);

CREATE INDEX IF NOT EXISTS "IDX_86033897c009fcca8b6505d6be" ON public.user_roles USING btree ("roleId");

CREATE INDEX IF NOT EXISTS "IDX_b4599f8b8f548d35850afa2d12" ON public.role_permissions USING btree ("roleId");

CREATE INDEX IF NOT EXISTS ip_bans_active_idx ON public.ip_bans USING btree (active) WHERE (active = true);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_066163c46cda7e8187f96bc87a0' AND conrelid = 'public.messages'::regclass) THEN
    ALTER TABLE ONLY public.messages
        ADD CONSTRAINT "FK_066163c46cda7e8187f96bc87a0" FOREIGN KEY ("sessionId") REFERENCES public.sessions(id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_06792d0c62ce6b0203c03643cdd' AND conrelid = 'public.role_permissions'::regclass) THEN
    ALTER TABLE ONLY public.role_permissions
        ADD CONSTRAINT "FK_06792d0c62ce6b0203c03643cdd" FOREIGN KEY ("permissionId") REFERENCES public.permissions(id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_0b06a7fdf7abaec277dadc9d9e0' AND conrelid = 'public.topology_node_layouts'::regclass) THEN
    ALTER TABLE ONLY public.topology_node_layouts
        ADD CONSTRAINT "FK_0b06a7fdf7abaec277dadc9d9e0" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_472b25323af01488f1f66a06b67' AND conrelid = 'public.user_roles'::regclass) THEN
    ALTER TABLE ONLY public.user_roles
        ADD CONSTRAINT "FK_472b25323af01488f1f66a06b67" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_57de40bc620f456c7311aa3a1e6' AND conrelid = 'public.sessions'::regclass) THEN
    ALTER TABLE ONLY public.sessions
        ADD CONSTRAINT "FK_57de40bc620f456c7311aa3a1e6" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_86033897c009fcca8b6505d6be2' AND conrelid = 'public.user_roles'::regclass) THEN
    ALTER TABLE ONLY public.user_roles
        ADD CONSTRAINT "FK_86033897c009fcca8b6505d6be2" FOREIGN KEY ("roleId") REFERENCES public.roles(id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_b4599f8b8f548d35850afa2d12c' AND conrelid = 'public.role_permissions'::regclass) THEN
    ALTER TABLE ONLY public.role_permissions
        ADD CONSTRAINT "FK_b4599f8b8f548d35850afa2d12c" FOREIGN KEY ("roleId") REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_f3827539132d937035ff5a2776b' AND conrelid = 'public.containers'::regclass) THEN
    ALTER TABLE ONLY public.containers
        ADD CONSTRAINT "FK_f3827539132d937035ff5a2776b" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ip_bans_created_by_fkey' AND conrelid = 'public.ip_bans'::regclass) THEN
    ALTER TABLE ONLY public.ip_bans
        ADD CONSTRAINT ip_bans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END
$$;
