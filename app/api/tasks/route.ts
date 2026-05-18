import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { newTaskSchema } from "@/lib/tasks/contracts";
import {
  createTask,
  listTasks,
  RepositoryError,
} from "@/lib/tasks/repository";
import { toErrorMessage } from "@/lib/utils";

function getErrorStatus(error: unknown) {
  if (error instanceof RepositoryError) {
    return error.status;
  }

  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") {
      return status;
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (
      message.includes("unauthorized") ||
      message.includes("invalid authentication") ||
      message.includes("jwt")
    ) {
      return 401;
    }

    if (
      message.includes("row-level security") ||
      message.includes("permission denied") ||
      message.includes("forbidden")
    ) {
      return 403;
    }

    if (error.name === "ZodError") {
      return 400;
    }
  }

  return 500;
}

function serializeError(error: unknown) {
  if (error instanceof RepositoryError) {
    return {
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      compensationError: error.compensationError,
    };
  }

  if (error instanceof Error) {
    return { error: error.message };
  }

  return { error: toErrorMessage(error) };
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "请先登录，登录后可以保存和查看历史任务。" },
        { status: 401 },
      );
    }

    const tasks = await listTasks(supabase, user.id);
    return NextResponse.json({ tasks });
  } catch (error) {
    return NextResponse.json(serializeError(error), {
      status: getErrorStatus(error),
    });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "请先登录，登录后可以保存和查看历史任务。" },
        { status: 401 },
      );
    }

    const payload = newTaskSchema.parse(await request.json());
    const task = await createTask(supabase, user.id, payload);

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return NextResponse.json(serializeError(error), {
      status: getErrorStatus(error),
    });
  }
}
