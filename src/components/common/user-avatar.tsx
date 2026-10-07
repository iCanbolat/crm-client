import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getInitials } from "@/lib/format"
import { cn } from "@/lib/utils"

interface UserAvatarProps {
  name: string
  src?: string | null
  className?: string
}

/**
 * Photo or initials. The initials use the foreground color: shadcn's
 * muted-on-muted default misses WCAG AA contrast (4.34:1).
 */
export function UserAvatar({ name, src, className }: UserAvatarProps) {
  return (
    <Avatar className={className}>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback className={cn("text-xs font-medium text-foreground")}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
