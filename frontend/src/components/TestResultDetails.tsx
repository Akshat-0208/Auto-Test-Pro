import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TestResult {
	type: string;
	element: string;
	status: string;
	error?: string;
	statusCode?: number;
	duration?: number;
	responseSize?: number;
	averageTime?: number;
	minTime?: number;
	maxTime?: number;
}

interface TestResultDetailsProps {
	result: {
		type: string;
		url: string;
		status: string;
		date: string;
		config: any;
		testsRun: number;
		passRate: number;
		duration: number;
		testResults: TestResult[];
	};
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function TestResultDetails({
	result,
	open,
	onOpenChange,
}: TestResultDetailsProps) {
	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleString();
	};

	const formatDuration = (seconds: number) => {
		return `${seconds.toFixed(2)}s`;
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[95vw] md:max-w-4xl h-[90vh] overflow-hidden">
				<DialogHeader>
					<DialogTitle className="text-base md:text-lg line-clamp-1 overflow-ellipsis">
						Test Results for {result.url}
					</DialogTitle>
				</DialogHeader>
				<div className="space-y-4 h-full overflow-hidden flex flex-col">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<h3 className="font-medium">Test Type</h3>
							<p className="text-sm text-muted-foreground capitalize">
								{result.type}
							</p>
						</div>
						<div>
							<h3 className="font-medium">Status</h3>
							<Badge
								variant={
									result.status === "completed"
										? "success"
										: "destructive"
								}
							>
								{result.status}
							</Badge>
						</div>
						<div>
							<h3 className="font-medium">Date</h3>
							<p className="text-sm text-muted-foreground">
								{formatDate(result.date)}
							</p>
						</div>
						<div>
							<h3 className="font-medium">Duration</h3>
							<p className="text-sm text-muted-foreground">
								{formatDuration(result.duration)}
							</p>
						</div>
						<div>
							<h3 className="font-medium">Tests Run</h3>
							<p className="text-sm text-muted-foreground">
								{result.testsRun}
							</p>
						</div>
						<div>
							<h3 className="font-medium">Pass Rate</h3>
							<p className="text-sm text-muted-foreground">
								{result.passRate.toFixed(1)}%
							</p>
						</div>
					</div>

					<div className="flex-1 min-h-[500px]">
						<h3 className="font-medium mb-2">Test Results</h3>
						{result.testResults ? (
							<ScrollArea className="h-[calc(90vh-320px)] rounded-md border">
								<div className="p-4 space-y-4">
									{result.testResults.map((test, index) => (
										<div
											key={index}
											className="border rounded-lg p-3 md:p-4 w-full"
										>
											<div className="flex justify-between gap-2 mb-3">
												<h4 className="font-medium capitalize">
													{test.type}
												</h4>
												<Badge
													variant={
														test.status === "passed"
															? "success"
															: "destructive"
													}
													className="w-fit"
												>
													{test.status}
												</Badge>
											</div>
											<p className="text-sm text-muted-foreground mb-2 break-all">
												Element: {test.element}
											</p>
											{test.statusCode && (
												<p className="text-sm text-muted-foreground mb-2">
													Status Code:{" "}
													{test.statusCode}
												</p>
											)}
											{test.duration && (
												<p className="text-sm text-muted-foreground mb-2">
													Duration:{" "}
													{formatDuration(
														test.duration
													)}
												</p>
											)}
											{test.responseSize && (
												<p className="text-sm text-muted-foreground mb-2">
													Response Size:{" "}
													{(
														test.responseSize / 1024
													).toFixed(2)}{" "}
													KB
												</p>
											)}
											{test.averageTime && (
												<p className="text-sm text-muted-foreground mb-2">
													Average Time:{" "}
													{formatDuration(
														test.averageTime
													)}
												</p>
											)}
											{test.minTime && test.maxTime && (
												<p className="text-sm text-muted-foreground mb-2">
													Time Range:{" "}
													{formatDuration(
														test.minTime
													)}{" "}
													-{" "}
													{formatDuration(
														test.maxTime
													)}
												</p>
											)}
											{test.error && (
												<p className="text-sm text-destructive mt-2 break-words">
													Error: {test.error}
												</p>
											)}
										</div>
									))}
								</div>
							</ScrollArea>
						) : (
							"Nothing to show"
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
