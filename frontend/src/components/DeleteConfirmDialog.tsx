import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteConfirmDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
	title: string;
	description: string;
}

export function DeleteConfirmDialog({
	isOpen,
	onClose,
	onConfirm,
	title,
	description,
}: DeleteConfirmDialogProps) {
	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<DialogFooter className="mt-4">
					<Button
						variant="outline"
						onClick={() => onClose()}
						className="mr-2"
					>
						Cancel
					</Button>
					<Button
						onClick={() => {
							onConfirm();
							onClose();
						}}
						variant="destructive"
					>
						Delete
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
