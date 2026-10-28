import type { MembershipChanges, MembershipPort } from "@/lib/data/ports";
import { addCivilDays, DomainError, EXPIRING_SOON_DAYS, membershipEditSchema } from "@/lib/domain";
import type { SupabaseClient } from "./client";
import { notFoundError, raise } from "./errors";
import { countOf, membershipsCount, membershipsQuery, rowsOf } from "./queries";
import {
  MEMBERSHIP_COLUMNS,
  membershipFromRow,
  membershipPageFromRow,
  type MembershipRow,
} from "./rows";

/** Solo las columnas que el entrenador puede corregir, y solo las que llegan. */
function membershipColumns(changes: MembershipChanges) {
  return {
    ...(changes.type !== undefined && { type: changes.type }),
    ...(changes.startDate !== undefined && { start_date: changes.startDate }),
    ...(changes.endDate !== undefined && { end_date: changes.endDate }),
    ...(changes.paymentStatus !== undefined && { payment_status: changes.paymentStatus }),
  };
}

export function createMembershipPort(client: SupabaseClient): MembershipPort {
  /**
   * `not_found` si el cliente no es de este entrenador (I1, I2). Un cliente dado de baja no admite
   * membresías nuevas ni cambios hasta que se dé de alta de nuevo (`is_writable_client`).
   */
  async function requireWritableClient(trainerId: string, clientId: string) {
    const { data, error } = await client
      .from("clients")
      .select("status")
      .eq("trainer_id", trainerId)
      .eq("id", clientId)
      .maybeSingle();
    raise(error);
    if (!data) throw notFoundError("Cliente");
    if (data.status === "dado_de_baja") {
      throw new DomainError("client.not_writable", "El cliente está dado de baja");
    }
  }

  /** Cabecera de conteo de la tabla, dentro del cliente elegido si lo hay. */
  const countable = (trainerId: string, clientId?: string) => {
    const scoped = membershipsCount(client, trainerId);
    return clientId ? scoped.eq("client_id", clientId) : scoped;
  };

  return {
    // Página, solapes y conteos en servidor (migración paged_reads).
    listMembershipsWithClients: async (trainerId, q) => {
      const { clientId, filter, today, page, pageSize } = q;
      const [all, unpaid, expiring, rows] = await Promise.all([
        countOf(countable(trainerId, clientId)),
        countOf(countable(trainerId, clientId).eq("payment_status", "no_pagada")),
        countOf(
          countable(trainerId, clientId)
            .lte("start_date", today)
            .gte("end_date", today)
            .lte("end_date", addCivilDays(today, EXPIRING_SOON_DAYS)),
        ),
        rowsOf(
          client.rpc("list_memberships_with_clients", {
            p_trainer_id: trainerId,
            p_client_id: clientId ?? null,
            p_filter: filter,
            p_today: today,
            p_page: page,
            p_page_size: pageSize,
          }),
          membershipPageFromRow,
        ),
      ]);
      return {
        rows: rows.map(({ membership, client: summary }) => ({ membership, client: summary })),
        counts: { all, unpaid, expiring },
        overlappingIds: rows.filter((r) => r.overlapping).map((r) => r.membership.id),
      };
    },

    listMemberships: (trainerId) =>
      rowsOf(
        membershipsQuery(client, trainerId).order("start_date", { ascending: false }),
        membershipFromRow,
      ),

    listClientMemberships: (trainerId, clientId) =>
      rowsOf(
        membershipsQuery(client, trainerId)
          .eq("client_id", clientId)
          .order("start_date", { ascending: false }),
        membershipFromRow,
      ),

    createMembership: async (input) => {
      await requireWritableClient(input.trainerId, input.clientId);
      const data = membershipEditSchema.parse(input);
      const { data: row, error } = await client
        .from("memberships")
        .insert({
          trainer_id: input.trainerId,
          client_id: input.clientId,
          type: data.type,
          start_date: data.startDate,
          end_date: data.endDate,
          payment_status: data.paymentStatus,
        })
        .select(MEMBERSHIP_COLUMNS)
        .single();
      raise(error);
      return membershipFromRow(row as MembershipRow);
    },

    updateMembership: async (trainerId, membershipId, changes) => {
      const { data: found, error: readError } = await client
        .from("memberships")
        .select(MEMBERSHIP_COLUMNS)
        .eq("trainer_id", trainerId)
        .eq("id", membershipId)
        .maybeSingle();
      raise(readError);
      if (!found) throw notFoundError("Membresía");

      const current = membershipFromRow(found as MembershipRow);
      await requireWritableClient(trainerId, current.clientId);
      // Valida la fila entera con el resultado: lo que llega debe cumplir el dominio tal cual.
      membershipEditSchema.parse({ ...current, ...changes });

      const { data, error } = await client
        .from("memberships")
        .update(membershipColumns(changes))
        .eq("trainer_id", trainerId)
        .eq("id", membershipId)
        .select(MEMBERSHIP_COLUMNS)
        .maybeSingle();
      raise(error);
      if (!data) throw notFoundError("Membresía");
      return membershipFromRow(data as MembershipRow);
    },
  };
}
