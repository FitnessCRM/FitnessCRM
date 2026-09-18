"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

/**
 * Los tres estados de una consulta en un solo sitio. `isEmpty` decide cuándo enseñar el vacío
 * (por defecto, array vacío o `null`); `children` solo se pinta con datos.
 */
export function QueryBoundary<T>({
  query,
  empty,
  isEmpty = (data) => data == null || (Array.isArray(data) && data.length === 0),
  loading,
  children,
}: {
  query: UseQueryResult<T>;
  empty: ReactNode;
  isEmpty?: (data: T) => boolean;
  loading?: ReactNode;
  children: (data: NonNullable<T>) => ReactNode;
}) {
  if (query.isPending) return <>{loading ?? <LoadingState />}</>;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  if (isEmpty(query.data)) return <>{empty}</>;
  return <>{children(query.data as NonNullable<T>)}</>;
}

export { EmptyState, ErrorState, LoadingState };
