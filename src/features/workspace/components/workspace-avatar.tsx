import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getInitials } from "@/lib/format"
import { cn } from "@/lib/utils"

interface WorkspaceAvatarProps {
  name: string
  logoUrl: string | null
  className?: string
}

export function WorkspaceAvatar({
  name,
  logoUrl,
  className,
}: WorkspaceAvatarProps) {
  return (
    <Avatar className={cn("size-8 rounded-xl", className)}>
      {logoUrl ? <AvatarImage src={logoUrl} alt="" /> : null}
      <AvatarFallback className="rounded-xl bg-primary text-xs text-primary-foreground">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
