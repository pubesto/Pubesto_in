"use client"

import { CirclePlus, FolderPlus, Tag, X } from "lucide-react"
import { useState } from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toAdminUppercase } from "@/lib/content-case"
import type { AdminCategoryOption } from "@/lib/server/dal/categories"
import type { AdminCollectionOption } from "@/lib/server/dal/products"

function Chip({
  children,
  onRemove,
  label,
}: {
  children: React.ReactNode
  onRemove: () => void
  label: string
}) {
  return (
    <span className="inline-flex h-7 w-fit max-w-full justify-self-start items-center gap-1 rounded-md bg-black/[0.07] py-1 pl-2 pr-1 text-xs font-medium text-black/70">
      <span className="truncate">{children}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="grid size-5 shrink-0 cursor-pointer place-items-center rounded text-black/45 transition hover:bg-black/10 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25"
      >
        <X className="size-3" />
      </button>
    </span>
  )
}

export function ProductOrganizationFields({
  categories,
  collections,
  categoryId,
  collectionIds,
  tags,
  onCategoryChange,
  onCollectionIdsChange,
  onTagsChange,
}: {
  categories: AdminCategoryOption[]
  collections: AdminCollectionOption[]
  categoryId: string
  collectionIds: string[]
  tags: string[]
  onCategoryChange: (categoryId: string) => void
  onCollectionIdsChange: (collectionIds: string[]) => void
  onTagsChange: (tags: string[]) => void
}) {
  const [collectionPickerOpen, setCollectionPickerOpen] = useState(false)
  const [tagDraft, setTagDraft] = useState("")
  const selectedCollections = collections.filter((collection) =>
    collectionIds.includes(collection.id),
  )

  function addTag(value = tagDraft) {
    const nextTags = toAdminUppercase(value)
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .filter((tag) => !tags.some((current) => current.toLowerCase() === tag.toLowerCase()))

    if (nextTags.length > 0) {
      onTagsChange([...tags, ...nextTags].slice(0, 30))
    }
    setTagDraft("")
  }

  function toggleCollection(collectionId: string) {
    onCollectionIdsChange(
      collectionIds.includes(collectionId)
        ? collectionIds.filter((id) => id !== collectionId)
        : [...collectionIds, collectionId],
    )
  }

  return (
    <div className="space-y-4 px-4 pb-4">
      <div className="grid gap-1.5 text-sm text-black/75">
        <span>Collections</span>
        <div className="min-h-10 rounded-lg border border-black/25 p-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedCollections.map((collection) => (
              <Chip
                key={collection.id}
                label={`${collection.title} collection`}
                onRemove={() => onCollectionIdsChange(collectionIds.filter((id) => id !== collection.id))}
              >
                {collection.title}
              </Chip>
            ))}
            <Popover open={collectionPickerOpen} onOpenChange={setCollectionPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-1.5 text-xs font-medium text-black/65 transition hover:bg-black/[0.06] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                >
                  {selectedCollections.length > 0 ? <FolderPlus className="size-3.5" /> : <CirclePlus className="size-3.5" />}
                  {selectedCollections.length > 0 ? "Add" : "Add collections"}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 gap-1.5 p-1.5">
                <p className="px-2 py-1 text-xs font-medium text-black/50">Add to collections</p>
                {collections.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-black/55">No collections are available yet.</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto">
                    {collections.map((collection) => {
                      const selected = collectionIds.includes(collection.id)
                      return (
                        <button
                          key={collection.id}
                          type="button"
                          role="checkbox"
                          aria-checked={selected}
                          onClick={() => toggleCollection(collection.id)}
                          className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-black/75 transition hover:bg-black/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                        >
                          <span className={`grid size-4 place-items-center rounded border ${selected ? "border-black bg-black text-white" : "border-black/35 bg-white"}`}>
                            {selected ? <span className="size-1.5 rounded-full bg-white" /> : null}
                          </span>
                          <span className="truncate">{collection.title}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <label className="grid gap-1.5 text-sm text-black/75">
        <span>Category</span>
        <Select value={categoryId || undefined} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-full rounded-lg border-black/25 !bg-white text-black shadow-none hover:!bg-white">
            <SelectValue placeholder="Add to a category" />
          </SelectTrigger>
          <SelectContent position="popper" className="bg-white text-black">
            {categories.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {categoryId ? (
          <Chip
            label={`${categories.find((option) => option.id === categoryId)?.name ?? "selected"} category`}
            onRemove={() => onCategoryChange("")}
          >
            {categories.find((option) => option.id === categoryId)?.name}
          </Chip>
        ) : null}
      </label>

      <div className="grid gap-1.5 text-sm text-black/75">
        <label htmlFor="product-tags">Tags</label>
        <div className="min-h-10 rounded-lg border border-black/25 p-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((tag) => (
              <Chip
                key={tag}
                label={`${tag} tag`}
                onRemove={() => onTagsChange(tags.filter((current) => current !== tag))}
              >
                <Tag className="size-3 text-black/45" />
                {tag}
              </Chip>
            ))}
            <input
              id="product-tags"
              value={tagDraft}
              onChange={(event) => setTagDraft(toAdminUppercase(event.target.value))}
              onBlur={() => addTag()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault()
                  addTag()
                }
                if (event.key === "Backspace" && !tagDraft && tags.length > 0) {
                  onTagsChange(tags.slice(0, -1))
                }
              }}
              placeholder={tags.length === 0 ? "Add tags" : "Add tag"}
              className="h-7 min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-black/45"
            />
          </div>
        </div>
        <p className="text-xs leading-5 text-black/50">Press Enter or comma to add a tag.</p>
      </div>
    </div>
  )
}
