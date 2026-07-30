import * as React from "react"
import { MoreHorizontalIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// kiOS: solo la estructura semántica de shadcn (nav/ul/li). Los controles
// interactivos los arma `@/ui/pagination` con el Button propio del design
// system — nunca con <a> ni con el buttonVariants de shadcn.
function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="Paginación"
      data-slot="pagination"
      className={cn("flex items-center", className)}
      {...props}
    />
  )
}

function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex flex-row items-center gap-1", className)}
      {...props}
    />
  )
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn("flex size-9 items-center justify-center text-muted-ink", className)}
      {...props}
    >
      <MoreHorizontalIcon className="size-4" />
      <span className="sr-only">Más páginas</span>
    </span>
  )
}

export { Pagination, PaginationContent, PaginationEllipsis, PaginationItem }
