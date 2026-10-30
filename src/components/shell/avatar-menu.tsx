"use client";

import { useRef } from "react";
import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** `requestSubmit` is missing on older Safari (< 16); `submit()` posts the same form. */
function submitSignOut(form: HTMLFormElement | null) {
  if (!form) return;
  if (typeof form.requestSubmit === "function") form.requestSubmit();
  else form.submit();
}

/**
 * Avatar menu (Header Bar): "EZ" on the `primary → chart-3` gradient; opens
 * Settings and Log out. The user is always shown as El Zavier.
 */
export function AvatarMenu() {
  const signOutRef = useRef<HTMLFormElement>(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu, El Zavier"
          className="relative grid size-10 shrink-0 cursor-pointer place-items-center rounded-md bg-[linear-gradient(135deg,var(--primary),var(--chart-3))] text-sm font-extrabold text-primary-foreground after:absolute after:-inset-0.5 after:content-[''] sm:after:hidden"
        >
          <span aria-hidden="true">EZ</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>El Zavier</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings aria-hidden="true" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => submitSignOut(signOutRef.current)}>
            <LogOut aria-hidden="true" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Outside the menu so it survives the menu closing on select. */}
      <form ref={signOutRef} action="/auth/signout" method="post" hidden />
    </>
  );
}
