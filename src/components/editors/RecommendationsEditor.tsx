// Thin wrapper around RelatedListEditor for the recommendations flavor.
// Kept as its own import so the existing call sites don't need to change.

import type { Item } from '../../types'
import RelatedListEditor from './RelatedListEditor'

export default function RecommendationsEditor(props: {
  ids: string[]
  options: Item[]
  onAdd: (id: string) => void
  onRemove: (id: string) => void
  pickerPlaceholder?: string
}) {
  return <RelatedListEditor mode="recommendations" {...props} />
}
