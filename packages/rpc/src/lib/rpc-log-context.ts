import { log } from "evlog";
import { useLogger as getRequestLogger } from "evlog/elysia";
import type { Context } from "../orpc";

/**
 * Merge RPC context into the active request wide event (evlog).
 */
export function enrichRpcWideEventContext(context: Context): void {
	const fields: Record<string, string | number | boolean> = {};

	if (context.user) {
		fields.rpc_user_id = context.user.id;
		if (context.user.email) {
			fields.rpc_user_email = context.user.email;
		}
		if (context.user.role) {
			fields.rpc_user_role = context.user.role;
		}
	}

	if (context.session) {
		fields.rpc_session_id = context.session.id;
	}

	if (context.headers) {
		const userAgent = context.headers.get("user-agent");
		if (userAgent) {
			fields.http_user_agent = userAgent;
		}

		const clientId = context.headers.get("databuddy-client-id");
		if (clientId) {
			fields.rpc_client_id = clientId;
		}

		const sdkName = context.headers.get("databuddy-sdk-name");
		if (sdkName) {
			fields.rpc_sdk_name = sdkName;
		}

		const sdkVersion = context.headers.get("databuddy-sdk-version");
		if (sdkVersion) {
			fields.rpc_sdk_version = sdkVersion;
		}
	}

	if (Object.keys(fields).length === 0) {
		return;
	}

	try {
		getRequestLogger().set(fields as Record<string, unknown>);
	} catch {
		log.info({ service: "rpc", ...fields });
	}
}

export function setRpcProcedureType(
	procedureType: "public" | "protected" | "admin" | "website"
): void {
	try {
		getRequestLogger().set({ rpc_procedure_type: procedureType });
	} catch {
		log.info({ service: "rpc", rpc_procedure_type: procedureType });
	}
}

export function recordORPCError(error: {
	code?: string;
	message?: string;
}): void {
	const message = error.message ?? error.code ?? "Unknown error";
	const err = new Error(message);
	try {
		getRequestLogger().error(err, {
			rpc_error_code: error.code,
			rpc_error_message: error.message,
		});
	} catch {
		log.error({
			service: "rpc",
			rpc_error_code: error.code,
			rpc_error_message: error.message,
		});
	}
}

export function createAbortSignalInterceptor<T = unknown>() {
	return ({
		request,
		next,
	}: {
		request: { signal?: AbortSignal };
		next: () => T;
	}) => {
		request.signal?.addEventListener("abort", () => {
			try {
				getRequestLogger().set({
					rpc_request_aborted: true,
					rpc_abort_reason: String(request.signal?.reason),
				});
			} catch {
				log.info({
					service: "rpc",
					rpc_request_aborted: true,
					rpc_abort_reason: String(request.signal?.reason),
				});
			}
		});

		return next();
	};
}
