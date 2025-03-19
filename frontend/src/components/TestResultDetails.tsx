import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Image as ImageIcon, Globe, Server } from "lucide-react";

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
	elementType?: string;
	innerHtml?: string;
	attributes?: Record<string, string>;
	src?: string;
	contentType?: string;
	responsePreview?: string;
	hasSvg?: boolean;
	endpoint?: string; // API endpoint URL
	requestType?: string; // GET, POST, PUT, DELETE
	elementPath?: string; // DOM path of the element
	action?: string; // Action performed on the element
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

	// Function to get badge variant based on request type
	const getRequestTypeBadgeVariant = (requestType?: string) => {
		if (!requestType) return "default";

		switch (requestType.toUpperCase()) {
			case "GET":
				return "success";
			case "POST":
				return "default";
			case "PUT":
				return "warning";
			case "DELETE":
				return "destructive";
			default:
				return "secondary";
		}
	};

	// Function to render element preview based on element type
	const renderElementPreview = (test: TestResult) => {
		// Extract element type from the element string if not provided directly
		const elementType =
			test.elementType ||
			test.element?.match(/<([a-z]+)[^>]*>/i)?.[1]?.toLowerCase() ||
			"";

		// Extract inner HTML or text if available
		const innerHtml =
			test.innerHtml || test.element?.match(/>([^<]*)</)?.[1] || "";

		// Check if element is an image
		if (elementType === "img" || test.element?.includes("<img")) {
			let src =
				test.src || test.element?.match(/src=["']([^"']+)["']/i)?.[1];

			// Handle relative URLs by prepending the base URL
			if (src && src.startsWith("/")) {
				// Extract domain from the test URL
				const urlObj = new URL(result.url);
				const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
				src = baseUrl + src;
			}

			if (src) {
				return (
					<div className="relative group mt-2 inline-block">
						<div className="flex items-center bg-muted rounded p-2">
							<ImageIcon className="h-5 w-5 mr-2" />
							<span className="text-sm">Image Preview</span>
						</div>
						<div className="absolute left-0 top-full mt-1 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 invisible group-hover:visible">
							<div className="bg-popover shadow-lg rounded-md p-1 border">
								<img
									src={src}
									alt="Element preview"
									className="max-w-[200px] max-h-[200px] object-contain"
									onError={(e) => {
										(
											e.target as HTMLImageElement
										).style.display = "none";
										(
											e.target as HTMLImageElement
										).nextSibling!.textContent =
											"Failed to load image";
									}}
								/>
								<div className="text-xs text-destructive"></div>
							</div>
						</div>
					</div>
				);
			}
		}

		// For buttons
		else if (
			elementType === "button" ||
			test.element?.includes("<button")
		) {
			// Check if button has SVG content from the backend or fallback to HTML check
			const hasSvg =
				test.hasSvg === true ||
				(!test.hasSvg && test.element?.includes("<svg"));

			// Get button text: prioritize innerHtml, then extract value attribute properly
			let buttonText = innerHtml;

			// If no innerHtml but has value attribute, extract it properly handling quotes
			if (!buttonText) {
				const valueMatch = test.element?.match(
					/value=["']([^"']*(?:(?:"|')[^"']*(?:"|')[^"']*)*)["']/i
				);
				if (valueMatch && valueMatch[1]) {
					buttonText = valueMatch[1];
				} else {
					buttonText = test.attributes?.value || "Button";
				}
			}

			return (
				<div className="mt-2">
					<div className="text-sm font-medium mb-1">
						Button Preview:
					</div>
					<button
						className="px-3 py-1 border rounded text-sm bg-secondary hover:bg-secondary/80 cursor-default"
						onClick={(e) => e.preventDefault()}
					>
						{hasSvg ? (
							<div className="flex items-center justify-center">
								<div className="text-xs bg-primary/10 p-1 rounded">
									<svg
										viewBox="0 0 24 24"
										className="h-4 w-4"
										stroke="currentColor"
										fill="none"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth="2"
											d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14"
										/>
									</svg>
								</div>
								<span className="ml-1">
									{buttonText === "Button" ||
									buttonText === "Icon Button"
										? "SVG Icon"
										: buttonText}
								</span>
							</div>
						) : (
							buttonText
						)}
					</button>
				</div>
			);
		}

		// For inputs
		else if (elementType === "input" || test.element?.includes("<input")) {
			const inputType =
				test.attributes?.type ||
				test.element?.match(/type=["']([^"']+)["']/i)?.[1] ||
				"text";

			// Get input value or placeholder with improved parsing
			let inputValue = "";

			// Try to extract from the element string with better handling of quotes
			const valueMatch = test.element?.match(
				/value=["']([^"']*(?:(?:"|')[^"']*(?:"|')[^"']*)*)["']/i
			);
			if (valueMatch && valueMatch[1]) {
				inputValue = valueMatch[1];
			} else {
				inputValue =
					test.attributes?.value ||
					test.attributes?.placeholder ||
					"";
			}

			if (inputType === "checkbox" || inputType === "radio") {
				// Get label text from attributes or default to type
				const labelText =
					test.attributes?.label ||
					inputValue ||
					inputType.charAt(0).toUpperCase() + inputType.slice(1);

				return (
					<div className="mt-2">
						<div className="text-sm font-medium mb-1">
							{inputType.charAt(0).toUpperCase() +
								inputType.slice(1)}{" "}
							Input:
						</div>
						<input
							type={inputType}
							disabled
							className="cursor-default"
						/>
						<span className="text-sm ml-2">{labelText}</span>
					</div>
				);
			}

			return (
				<div className="mt-2">
					<div className="text-sm font-medium mb-1">
						Input Preview:
					</div>
					<input
						type={inputType}
						value={inputValue}
						placeholder={
							!inputValue
								? inputType.charAt(0).toUpperCase() +
								  inputType.slice(1) +
								  " input"
								: ""
						}
						disabled
						className="px-3 py-1 border rounded text-sm bg-muted cursor-default w-64"
					/>
				</div>
			);
		}

		// For select dropdowns
		else if (
			elementType === "select" ||
			test.element?.includes("<select")
		) {
			return (
				<div className="mt-2">
					<div className="text-sm font-medium mb-1">
						Select Dropdown:
					</div>
					<select
						disabled
						className="px-3 py-1 border rounded text-sm bg-muted cursor-default"
					>
						<option>Dropdown options</option>
					</select>
				</div>
			);
		}

		// For textarea
		else if (
			elementType === "textarea" ||
			test.element?.includes("<textarea")
		) {
			return (
				<div className="mt-2">
					<div className="text-sm font-medium mb-1">Textarea:</div>
					<textarea
						disabled
						placeholder="Textarea content"
						className="px-3 py-1 border rounded text-sm bg-muted cursor-default w-64 h-20"
					></textarea>
				</div>
			);
		}

		// For API endpoints
		else if (elementType === "endpoint" && test.responsePreview) {
			const isJson = test.contentType?.includes("application/json");

			return (
				<div className="mt-2">
					<div className="flex items-center font-medium mb-1">
						<Globe className="h-4 w-4 mr-1" />
						<span className="text-sm">API Response:</span>
						{test.contentType && (
							<Badge variant="outline" className="ml-2 text-xs">
								{test.contentType.split(";")[0]}
							</Badge>
						)}
					</div>
					<div className="bg-muted rounded-md p-3 mt-1 text-sm overflow-x-auto">
						<pre
							className={`${
								isJson ? "text-primary" : ""
							} text-xs whitespace-pre-wrap break-words`}
						>
							{test.responsePreview}
						</pre>
					</div>
				</div>
			);
		}

		// Default - no special rendering
		return null;
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[95vw] md:max-w-4xl h-[90vh] overflow-hidden">
				<DialogHeader>
					<DialogTitle className="text-base md:text-lg relative group">
						<span className="line-clamp-1 overflow-ellipsis">
							Test Results for{" "}
							{result.url.length > 40 ? (
								<>
									{result.url.substring(0, 40)}
									<span className="text-primary">...</span>
									<div className="absolute left-0 top-full mt-1 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 invisible group-hover:visible">
										<div className="bg-popover shadow-md rounded-md p-2 text-sm border max-w-md break-all">
											{result.url}
										</div>
									</div>
								</>
							) : (
								result.url
							)}
						</span>
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

											{/* API Endpoint Information - Show for API tests */}
											{result.type === "api" && (
												<div className="mb-3 bg-muted/50 p-2 rounded-md">
													<div className="flex items-center gap-2 mb-1 flex-wrap">
														<Server className="h-4 w-4" />
														<span className="text-sm font-medium">
															API Endpoint:
														</span>

														{test.requestType && (
															<Badge
																variant={getRequestTypeBadgeVariant(
																	test.requestType
																)}
																className="text-xs"
															>
																{test.requestType.toUpperCase()}
															</Badge>
														)}
													</div>
													<p className="text-sm text-muted-foreground break-all pl-6">
														{test.endpoint ||
															"Unknown endpoint"}
													</p>
												</div>
											)}

											{/* Element Information */}
											<div className="mb-3">
												<p className="text-sm text-muted-foreground mb-2 break-all">
													Element: {test.element}
												</p>

												{/* Element Path Information */}
												{test.elementPath && (
													<p className="text-sm text-muted-foreground mb-2">
														<span className="font-medium">
															Path:
														</span>{" "}
														{test.elementPath}
													</p>
												)}

												{/* Action Information */}
												{test.action && (
													<p className="text-sm text-muted-foreground mb-2">
														<span className="font-medium">
															Action:
														</span>{" "}
														{test.action}
													</p>
												)}

												{/* Element Preview */}
												{renderElementPreview(test)}
											</div>

											{/* API-specific information */}
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
