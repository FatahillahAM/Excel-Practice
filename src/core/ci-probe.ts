// CI probe for story 1.6: this import must make CI fail at the lint step (AD-1).
// Reverted by the next commit.
import { NextResponse } from "next/server";

export const probe = NextResponse;
