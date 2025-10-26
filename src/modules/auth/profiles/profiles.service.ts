import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from 'src/common/db/pg.constants';
import { SearchProfilesDto } from '../dto/search-profiles.dto';

type UserRole = 'candidate' | 'company_admin' | 'headhunter' | 'admin';
type UserStatus = 'active' | 'inactive' | 'banned' | 'pending';

@Injectable()
export class ProfilesService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) { }

  private toJsonArray(val: any): any[] {
    if (val == null) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
      } catch {
        return [];
      }
    }
    return [val];
  }

  private normalizeRow<T extends Record<string, any>>(row: T): T {
    if (!row) return row;
    return {
      ...row,
      experience: this.toJsonArray(row.experience),
      education: this.toJsonArray(row.education),
    };
  }

  async upsert(
    userId: string,
    payload: {
      email?: string;
      full_name?: string;
      phone?: string;
      role?: UserRole;
      status?: UserStatus;
      profile_picture?: string | null;
      cover_photo?: string | null;
      occupation?: string | null;
      about_me?: string | null;
      skills?: string[] | null;
      experience?: any;
      education?: any;
      cv_url?: string | null;
      reputation_score?: number | null;
    },
  ) {
    const sql = `
      INSERT INTO public.profiles
        (id, email, full_name, phone, role, status,
         profile_picture, cover_photo, occupation, about_me, skills,
         experience, education, cv_url, reputation_score, created_at, updated_at)
      VALUES
        ($1,$2,$3,$4,$5::user_role,$6::user_status,
         $7,$8,$9,$10,$11,$12,$13,$14,$15, now(), now())
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        role = EXCLUDED.role,
        status = EXCLUDED.status,

        /* No sobreescribir avatar personalizado: sólo si estaba vacío o era de Google */
        profile_picture = CASE
          WHEN public.profiles.profile_picture IS NULL
               OR public.profiles.profile_picture = ''
               OR public.profiles.profile_picture LIKE 'https://lh3.googleusercontent.com/%'
          THEN COALESCE(EXCLUDED.profile_picture, public.profiles.profile_picture)
          ELSE public.profiles.profile_picture
        END,

        /* opcional: misma idea para cover si lo quieres */
        cover_photo = CASE
          WHEN public.profiles.cover_photo IS NULL
               OR public.profiles.cover_photo = ''
          THEN COALESCE(EXCLUDED.cover_photo, public.profiles.cover_photo)
          ELSE public.profiles.cover_photo
        END,

        occupation = EXCLUDED.occupation,
        about_me = EXCLUDED.about_me,
        skills = EXCLUDED.skills,
        experience = EXCLUDED.experience,
        education = EXCLUDED.education,
        cv_url = EXCLUDED.cv_url,
        reputation_score = EXCLUDED.reputation_score,
        updated_at = now()
      RETURNING
        id, email, full_name, phone, role, status,
        profile_picture, cover_photo, occupation, about_me,
        skills,
        -- 🔽 aquí normalizamos a arrays en SQL por si son null
        COALESCE(
          CASE
            WHEN jsonb_typeof(experience) = 'array' THEN experience
            WHEN experience IS NULL THEN '[]'::jsonb
            ELSE jsonb_build_array(experience)
          END,
        '[]'::jsonb) AS experience,
        COALESCE(
          CASE
            WHEN jsonb_typeof(education) = 'array' THEN education
            WHEN education IS NULL THEN '[]'::jsonb
            ELSE jsonb_build_array(education)
          END,
        '[]'::jsonb) AS education,
        cv_url, reputation_score, created_at, updated_at
    `;

    const params = [
      userId,
      payload.email ?? null,
      payload.full_name ?? '',
      payload.phone ?? null,
      payload.role ?? 'candidate',
      payload.status ?? 'active',
      payload.profile_picture ?? null,
      payload.cover_photo ?? null,
      payload.occupation ?? null,
      payload.about_me ?? null,
      payload.skills ?? null,
      // Guardamos el json como venga (objeto/array) y lo normalizamos al leer
      payload.experience ?? null,
      payload.education ?? null,
      payload.cv_url ?? null,
      payload.reputation_score ?? null,
    ];

    const { rows } = await this.pool.query(sql, params);
    return this.normalizeRow(rows[0]);
  }

  async findOne(userId: string) {
    const { rows } = await this.pool.query(
      `
      SELECT
        id, email, full_name, phone, role, status,
        profile_picture, cover_photo, occupation, about_me,
        skills,
        -- 🔽 normalización a arrays para evitar Expected Iterable
        COALESCE(
          CASE
            WHEN jsonb_typeof(experience) = 'array' THEN experience
            WHEN experience IS NULL THEN '[]'::jsonb
            ELSE jsonb_build_array(experience)
          END,
        '[]'::jsonb) AS experience,
        COALESCE(
          CASE
            WHEN jsonb_typeof(education) = 'array' THEN education
            WHEN education IS NULL THEN '[]'::jsonb
            ELSE jsonb_build_array(education)
          END,
        '[]'::jsonb) AS education,
        cv_url, reputation_score, created_at, updated_at
      FROM public.profiles
      WHERE id = $1
      `,
      [userId],
    );
    if (!rows[0]) throw new NotFoundException('profile_not_found');
    return this.normalizeRow(rows[0]);
  }

  // src/profiles/profiles.service.ts
  async updatePartial(userId: string, patch: Record<string, any>) {
    const allowed = [
      'email', 'full_name', 'phone', 'role', 'status',
      'profile_picture', 'cover_photo', 'occupation', 'about_me',
      'skills', 'experience', 'education', 'cv_url', 'reputation_score',
    ];

    const sets: string[] = [];
    const params: any[] = [];

    for (const key of allowed) {
      if (patch[key] !== undefined) {
        // role/status ya los casteas arriba; mantenlo
        if (key === 'role') {
          params.push(patch[key]);
          sets.push(`role = $${params.length}::user_role`);
        } else if (key === 'status') {
          params.push(patch[key]);
          sets.push(`status = $${params.length}::user_status`);
        } else if (key === 'skills') {
          // Asegura text[]
          // Si te llega [], envía NULL o un array vacío explícito
          const skills = Array.isArray(patch.skills) && patch.skills.length ? patch.skills : null;
          params.push(skills);
          sets.push(`skills = $${params.length}::text[]`);
        } else if (key === 'experience' || key === 'education') {
          // Asegura jsonb (array u objeto o null)
          const jsonVal = patch[key] == null ? null : JSON.stringify(patch[key]);
          params.push(jsonVal);
          sets.push(`${key} = $${params.length}::jsonb`);
        } else if (key === 'reputation_score') {
          params.push(patch[key]);
          sets.push(`reputation_score = $${params.length}::numeric`);
        } else {
          // texto/otros
          params.push(patch[key]);
          sets.push(`${key} = $${params.length}`);
        }
      }
    }

    if (!sets.length) {
      const { rows } = await this.pool.query(
        `
      SELECT
        id, email, full_name, phone, role, status,
        profile_picture, cover_photo, occupation, about_me, skills,
        COALESCE(
          CASE
            WHEN jsonb_typeof(experience) = 'array' THEN experience
            WHEN experience IS NULL THEN '[]'::jsonb
            ELSE jsonb_build_array(experience)
          END, '[]'::jsonb
        ) AS experience,
        COALESCE(
          CASE
            WHEN jsonb_typeof(education) = 'array' THEN education
            WHEN education IS NULL THEN '[]'::jsonb
            ELSE jsonb_build_array(education)
          END, '[]'::jsonb
        ) AS education,
        cv_url, reputation_score, created_at, updated_at
      FROM public.profiles
      WHERE id = $1
      `,
        [userId],
      );
      if (!rows[0]) throw new NotFoundException('profile_not_found');
      return this.normalizeRow(rows[0]);
    }

    params.push(userId);
    const sql = `
    UPDATE public.profiles
    SET ${sets.join(', ')}, updated_at = now()
    WHERE id = $${params.length}
    RETURNING
      id, email, full_name, phone, role, status,
      profile_picture, cover_photo, occupation, about_me, skills,
      COALESCE(
        CASE
          WHEN jsonb_typeof(experience) = 'array' THEN experience
          WHEN experience IS NULL THEN '[]'::jsonb
          ELSE jsonb_build_array(experience)
        END, '[]'::jsonb
      ) AS experience,
      COALESCE(
        CASE
          WHEN jsonb_typeof(education) = 'array' THEN education
          WHEN education IS NULL THEN '[]'::jsonb
          ELSE jsonb_build_array(education)
        END, '[]'::jsonb
      ) AS education,
      cv_url, reputation_score, created_at, updated_at
  `;
    const { rows } = await this.pool.query(sql, params);
    if (!rows[0]) throw new NotFoundException('profile_not_found');
    return this.normalizeRow(rows[0]);
  }


  async search(dto: SearchProfilesDto) {
    const where: string[] = [];
    const vals: any[] = [];
    const push = (frag: string, val: any, cast?: string) => {
      const i = vals.length + 1;
      where.push(`${frag} $${i}${cast ? `::${cast}` : ''}`);
      vals.push(val);
    };

    if (dto.q) {
      const i = vals.length + 1;
      const pat = `%${dto.q}%`;
      where.push(`(
        full_name ILIKE $${i}
        OR email ILIKE $${i}
        OR occupation ILIKE $${i}
        OR about_me ILIKE $${i}
      )`);
      vals.push(pat);
    }

    if (dto.role) push('role =', dto.role, 'user_role');
    if (dto.status) push('status =', dto.status, 'user_status');
    if (dto.minReputation != null) push('reputation_score >=', dto.minReputation);
    if (dto.maxReputation != null) push('reputation_score <=', dto.maxReputation);

    if (dto.skillsAny?.length) {
      push('skills &&', dto.skillsAny, 'text[]');
    }
    if (dto.skillsAll?.length) {
      push('skills @>', dto.skillsAll, 'text[]');
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const sortMap: Record<string, string> = {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      reputation: 'reputation_score',
      name: 'full_name',
    };
    const sortCol = sortMap[dto.sortBy || 'createdAt'] || 'created_at';
    const order =
      (dto.order || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    vals.push(dto.limit ?? 50);
    vals.push(dto.offset ?? 0);

    const sql = `
      SELECT
        id, email, full_name, phone, role, status, profile_picture, cover_photo,
        occupation, about_me, skills,
        -- 🔽 normalizamos a arrays para evitar errores en GraphQL
        COALESCE(
          CASE
            WHEN jsonb_typeof(experience) = 'array' THEN experience
            WHEN experience IS NULL THEN '[]'::jsonb
            ELSE jsonb_build_array(experience)
          END,
        '[]'::jsonb) AS experience,
        COALESCE(
          CASE
            WHEN jsonb_typeof(education) = 'array' THEN education
            WHEN education IS NULL THEN '[]'::jsonb
            ELSE jsonb_build_array(education)
          END,
        '[]'::jsonb) AS education,
        cv_url, reputation_score, created_at, updated_at
      FROM public.profiles
      ${whereSql}
      ORDER BY ${sortCol} ${order}
      LIMIT $${vals.length - 1} OFFSET $${vals.length}
    `;

    const { rows } = await this.pool.query(sql, vals);
    return rows.map((r) => this.normalizeRow(r));
  }
}
