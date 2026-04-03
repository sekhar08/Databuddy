"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useOrganizationsContext } from "@/components/providers/organizations-provider";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Sheet,
	SheetBody,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/lib/orpc";

const statusPageFormSchema = z.object({
	name: z.string().min(1, "Name is required"),
	slug: z
		.string()
		.min(1, "Slug is required")
		.regex(
			/^[a-z0-9-]+$/,
			"Slug must only contain lowercase letters, numbers, and dashes"
		),
	description: z.string().optional(),
});

type StatusPageFormData = z.infer<typeof statusPageFormSchema>;

interface StatusPageSheetProps {
	open: boolean;
	onCloseAction: (open: boolean) => void;
	onSaveAction?: () => void;
	statusPage?: {
		id: string;
		name: string;
		slug: string;
		description?: string | null;
	} | null;
}

export function StatusPageSheet({
	open,
	onCloseAction,
	onSaveAction,
	statusPage,
}: StatusPageSheetProps) {
	const isEditing = !!statusPage;
	const { activeOrganizationId, activeOrganization } =
		useOrganizationsContext();

	const form = useForm<StatusPageFormData>({
		resolver: zodResolver(statusPageFormSchema),
		defaultValues: {
			name: statusPage?.name ?? "",
			slug: statusPage?.slug ?? "",
			description: statusPage?.description ?? "",
		},
	});

	const createMutation = useMutation({
		...orpc.statusPage.create.mutationOptions(),
	});
	const updateMutation = useMutation({
		...orpc.statusPage.update.mutationOptions(),
	});

	useEffect(() => {
		if (open) {
			form.reset({
				name: statusPage?.name ?? "",
				slug: statusPage?.slug ?? "",
				description: statusPage?.description ?? "",
			});
		}
	}, [open, statusPage, form]);

	const handleSubmit = async () => {
		const data = form.getValues();

		try {
			if (isEditing && statusPage) {
				await updateMutation.mutateAsync({
					statusPageId: statusPage.id,
					name: data.name,
					slug: data.slug,
					description: data.description,
				});
				toast.success("Status page updated successfully");
			} else {
				const resolvedOrganizationId =
					activeOrganization?.id ?? activeOrganizationId ?? null;

				if (!resolvedOrganizationId) {
					toast.error("No active organization selected");
					return;
				}

				await createMutation.mutateAsync({
					organizationId: resolvedOrganizationId,
					name: data.name,
					slug: data.slug,
					description: data.description,
				});
				toast.success("Status page created successfully");
			}
			onSaveAction?.();
			onCloseAction(false);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Failed to save status page";
			toast.error(errorMessage);
		}
	};

	const isPending = createMutation.isPending || updateMutation.isPending;

	return (
		<Sheet onOpenChange={onCloseAction} open={open}>
			<SheetContent className="w-full sm:max-w-xl">
				<SheetHeader>
					<SheetTitle>
						{isEditing ? "Edit Status Page" : "Create Status Page"}
					</SheetTitle>
					<SheetDescription>
						{isEditing
							? "Update your status page details"
							: "Set up a new public status page"}
					</SheetDescription>
				</SheetHeader>

				<Form {...form}>
					<form
						className="flex flex-1 flex-col overflow-hidden"
						onSubmit={form.handleSubmit(handleSubmit)}
					>
						<SheetBody className="space-y-6">
							<div className="space-y-4">
								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Name</FormLabel>
											<FormControl>
												<Input placeholder="e.g. Acme Systems" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="slug"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Slug</FormLabel>
											<FormControl>
												<Input placeholder="e.g. acme-systems" {...field} />
											</FormControl>
											<p className="text-[0.8rem] text-muted-foreground">
												This will be the URL path for your status page.
											</p>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="description"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Description (Optional)</FormLabel>
											<FormControl>
												<Textarea
													placeholder="e.g. Real-time status for our core services."
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>
						</SheetBody>

						<SheetFooter>
							<Button
								onClick={() => onCloseAction(false)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button
								className="min-w-28"
								disabled={isPending || !form.formState.isValid}
								type="submit"
							>
								{isPending ? "Saving..." : isEditing ? "Update" : "Create"}
							</Button>
						</SheetFooter>
					</form>
				</Form>
			</SheetContent>
		</Sheet>
	);
}
