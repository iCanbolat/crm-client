import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { recordKeys } from "@/features/records"

import { fetchBoard } from "./pipelines.api"
import type { BoardParams } from "./pipelines.schemas"

/**
 * Nested under the object's record keys: every record mutation of the
 * object (create, edit, stage move) refreshes the board as well.
 */
export const boardKeys = {
  boards: (objectKey: string) =>
    [...recordKeys.object(objectKey), "board"] as const,
  board: (objectKey: string, params: BoardParams) =>
    [...boardKeys.boards(objectKey), params] as const,
}

export const boardQueries = {
  board: (objectKey: string, params: BoardParams) =>
    queryOptions({
      queryKey: boardKeys.board(objectKey, params),
      queryFn: ({ signal }) => fetchBoard(objectKey, params, signal),
      placeholderData: keepPreviousData,
    }),
}
