import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "@/components/ui/sonner";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { TestResultDetails } from "@/components/TestResultDetails";
import { Download, Trash2, RefreshCw } from "lucide-react";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import * as XLSX from "xlsx";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TestResult {
	_id?: string;
	id?: string;
	testId?: string;
	resultId?: string;
	test_id?: string;
	url: string;
	type: string;
	status: string;
	date: string;
	passRate: number;
	testsRun: number;
	duration: number;
	config: any;
	testResults: any[];
	elementType?: string;
	elementPath?: string; // DOM path of the element
	action?: string; // Action performed on the element
	innerHtml?: string;
	attributes?: Record<string, string>;
	hasSvg?: boolean;
	endpoint?: string; // API endpoint URL
	requestType?: string; // GET, POST, PUT, DELETE
	[key: string]: any; // Allow for any additional properties
}

export default function Results() {
	const [results, setResults] = useState<TestResult[]>([]);
	const [loading, setLoading] = useState(true);
	const [filter, setFilter] = useState("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const [selectedResult, setSelectedResult] = useState<TestResult | null>(
		null
	);
	const [showDetails, setShowDetails] = useState(false);
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const [resultToDelete, setResultToDelete] = useState<TestResult | null>(
		null
	);
	const resultsPerPage = 10;

	const fetchResults = async () => {
		try {
			const response = await axios.get(
				"http://localhost:5000/api/results"
			);

			// Map the results to ensure each has a consistent ID property and default values for required fields
			const processedResults = response.data.map((result: any) => {
				// Try to find an ID property - MongoDB might return _id
				let id = null;
				if (result._id) id = result._id;
				else if (result.id) id = result.id;
				else if (result.testId) id = result.testId;

				// Ensure all required fields have default values
				return {
					...result,
					_id: id, // Ensure _id exists
					id: id, // Ensure id exists
					passRate: result.passRate ?? 0,
					testsRun: result.testsRun ?? 0,
					duration: result.duration ?? 0,
					status: result.status || "unknown",
					testResults: result.testResults || [],
				};
			});

			setResults(processedResults);
		} catch (error) {
			toast.error("Failed to fetch results");
			console.error(error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchResults();
	}, []);

	// Check for test ID in URL parameter
	useEffect(() => {
		// Check URL parameters to see if we're waiting for a specific test
		const params = new URLSearchParams(window.location.search);
		const testIdToWatch = params.get("id");

		// Only run this effect when results are loaded and we have a test ID
		if (testIdToWatch && results.length > 0) {
			const watchedTest = results.find((r) => r.testId === testIdToWatch);

			if (watchedTest) {
				// If test is already completed or failed, show it
				if (
					watchedTest.status === "completed" ||
					watchedTest.status === "failed"
				) {
					// Show toast notification
					toast.success(
						`Test ${
							watchedTest.name || "ID: " + watchedTest.testId
						} is ${watchedTest.status}`
					);

					// Highlight the test result
					setSelectedResult(watchedTest);
					setShowDetails(true);

					// Clean URL parameter
					if (window.history.replaceState) {
						const newUrl = window.location.pathname;
						window.history.replaceState(
							{ path: newUrl },
							"",
							newUrl
						);
					}
				} else if (watchedTest.status === "running") {
					// If test is still running, show info message
					toast.info(
						`Test ${
							watchedTest.name || "ID: " + watchedTest.testId
						} is still running. Refresh the page to check for updates.`
					);

					// Highlight the test result
					setSelectedResult(watchedTest);
					setShowDetails(true);
				}
			}
		}
	}, [results]);

	// Add effect to clear selected result when dialog closes
	useEffect(() => {
		if (!showDetails) {
			setSelectedResult(null);
		}
	}, [showDetails]);

	const filteredResults = results.filter((result) => {
		// Filter by type
		const matchesFilter =
			filter === "all" ||
			result.type === filter ||
			(filter === "api" && result.type === "api-batch") || // Show batch tests under API
			(filter === "api" &&
				result.type === "api" &&
				result.name === "Unified API Test"); // Show unified tests under API

		// Filter by search term
		const matchesSearch = result.url
			? result.url.toLowerCase().includes(searchQuery.toLowerCase())
			: result.name // For batch tests or unified tests, check name if available
			? result.name.toLowerCase().includes(searchQuery.toLowerCase())
			: false;

		return matchesFilter && matchesSearch;
	});

	// Sort: Show most recent first, prioritize unified and batch tests
	const sortedResults = [...filteredResults].sort((a, b) => {
		// First sort by type - unified and batch tests come first
		if (
			(a.name === "Unified API Test" || a.type === "api-batch") &&
			b.name !== "Unified API Test" &&
			b.type !== "api-batch"
		)
			return -1;
		if (
			a.name !== "Unified API Test" &&
			a.type !== "api-batch" &&
			(b.name === "Unified API Test" || b.type === "api-batch")
		)
			return 1;

		// Then sort by date (most recent first)
		return new Date(b.date).getTime() - new Date(a.date).getTime();
	});

	const totalPages = Math.ceil(sortedResults.length / resultsPerPage);
	const paginatedResults = sortedResults.slice(
		(currentPage - 1) * resultsPerPage,
		currentPage * resultsPerPage
	);

	const handleResultClick = (result: TestResult) => {
		setSelectedResult(result);
		setShowDetails(true);
	};

	const handleDelete = async (e: React.MouseEvent, result: TestResult) => {
		e.stopPropagation();

		// Show confirm dialog
		setResultToDelete(result);
		setDeleteConfirmOpen(true);
	};

	const confirmDelete = async () => {
		if (!resultToDelete) return;

		const id = resultToDelete.testId;

		if (!id) {
			toast.error("Cannot delete: Test result has no ID");
			return;
		}

		try {
			setLoading(true);
			await axios.delete(`http://localhost:5000/api/results/${id}`);
			toast.success("Test result deleted successfully");
			fetchResults();
		} catch (error) {
			console.error("Error deleting test result:", error);
			toast.error("Failed to delete test result");
		} finally {
			setLoading(false);
			setResultToDelete(null);
		}
	};

	const handleDownload = async (e: React.MouseEvent, result: TestResult) => {
		e.stopPropagation(); // Stop propagation to prevent row click

		try {
			// Create workbook and worksheet
			const wb = XLSX.utils.book_new();

			// Create test summary sheet
			const summaryData = [
				["Test URL", result.url],
				["Test Type", result.type],
				["Status", result.status],
				["Date", new Date(result.date).toLocaleString()],
				["Duration", `${result.duration.toFixed(2)}s`],
				["Tests Run", result.testsRun],
				["Pass Rate", `${result.passRate.toFixed(1)}%`],
				["", ""], // Empty row for spacing
				["Test Configuration", ""],
			];

			// Add config details
			if (result.config) {
				Object.entries(result.config).forEach(([key, value]) => {
					if (typeof value === "boolean") {
						summaryData.push([key, value ? "Yes" : "No"]);
					} else {
						summaryData.push([key, value as string]);
					}
				});
			}

			const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
			XLSX.utils.book_append_sheet(wb, summaryWS, "Test Summary");

			// Create detailed results sheet with different formats based on test type
			if (result.type === "api") {
				// API Test format - Organize by request method
				const apiHeaders = [
					"Endpoint",
					"Method",
					"Test Type",
					"Status",
					"Response Time",
					"Details",
				];

				// Group test results by method
				const methodGroups: Record<string, any[]> = {};

				if (result.testResults && result.testResults.length > 0) {
					// First pass: group by method
					result.testResults.forEach((testResult) => {
						const method =
							testResult.requestType ||
							testResult.method ||
							"GET";
						if (!methodGroups[method]) {
							methodGroups[method] = [];
						}
						methodGroups[method].push(testResult);
					});
				}

				// Create sheets for each request method type
				const methodOrder = ["GET", "POST", "PUT", "PATCH", "DELETE"];

				// Create a consolidated "All Tests" sheet
				const allTestsData = [apiHeaders];
				if (result.testResults && result.testResults.length > 0) {
					result.testResults.forEach((testResult) => {
						// Extract relevant API test information
						const endpoint =
							testResult.endpoint ||
							result.endpoint ||
							"Unknown endpoint";
						const method =
							testResult.requestType ||
							testResult.method ||
							"GET";

						// Determine test type
						let testType = testResult.testType || "General";

						// Format response time if available
						const responseTime = testResult.responseTime
							? `${testResult.responseTime.toFixed(2)}ms`
							: "N/A";

						// Details field combines any available information
						let details = testResult.description || "";
						if (testResult.error) {
							details += ` Error: ${testResult.error}`;
						}
						if (testResult.details) {
							details += ` ${testResult.details}`;
						}

						// Add to data array
						allTestsData.push([
							endpoint,
							method,
							testType,
							testResult.status || "unknown",
							responseTime,
							details,
						]);
					});
				}

				// Add the consolidated sheet
				const allTestsWS = XLSX.utils.aoa_to_sheet(allTestsData);

				// Set column widths
				const apiColWidths = [
					{ wch: 40 }, // Endpoint
					{ wch: 10 }, // Method
					{ wch: 20 }, // Test Type
					{ wch: 15 }, // Status
					{ wch: 15 }, // Response Time
					{ wch: 50 }, // Details
				];
				allTestsWS["!cols"] = apiColWidths;

				XLSX.utils.book_append_sheet(wb, allTestsWS, "All API Tests");

				// Create method-specific sheets for methods that have tests
				methodOrder.forEach((method) => {
					if (
						methodGroups[method] &&
						methodGroups[method].length > 0
					) {
						const methodData = [apiHeaders];

						methodGroups[method].forEach((testResult) => {
							const endpoint =
								testResult.endpoint ||
								result.endpoint ||
								"Unknown endpoint";

							// Determine test type
							let testType = testResult.testType || "General";

							// Format response time if available
							const responseTime = testResult.responseTime
								? `${testResult.responseTime.toFixed(2)}ms`
								: "N/A";

							// Details field
							let details = testResult.description || "";
							if (testResult.error) {
								details += ` Error: ${testResult.error}`;
							}
							if (testResult.details) {
								details += ` ${testResult.details}`;
							}

							// Add to method specific data
							methodData.push([
								endpoint,
								method,
								testType,
								testResult.status || "unknown",
								responseTime,
								details,
							]);
						});

						// Create worksheet for this method
						const methodWS = XLSX.utils.aoa_to_sheet(methodData);
						methodWS["!cols"] = apiColWidths;

						XLSX.utils.book_append_sheet(
							wb,
							methodWS,
							`${method} Tests`
						);
					}
				});
			} else {
				// UI Test format
				const uiHeaders = ["Element", "Action", "Result"];
				const uiData = [uiHeaders];

				if (result.testResults && result.testResults.length > 0) {
					result.testResults.forEach((testResult) => {
						// Create meaningful element representation
						let elementInfo = "";
						if (testResult.elementType) {
							elementInfo = `${testResult.elementType} [${
								testResult.elementPath || "Unknown path"
							}]`;

							// For buttons, include text content
							if (
								testResult.elementType === "button" ||
								testResult.elementType === "input"
							) {
								if (testResult.innerHtml) {
									elementInfo += ` "${testResult.innerHtml}"`;
								}
							}

							// For inputs, include type info
							if (
								testResult.elementType === "input" &&
								testResult.attributes?.type
							) {
								elementInfo += ` type=${testResult.attributes.type}`;
							}

							// For images, include alt text
							if (
								testResult.elementType === "img" &&
								testResult.attributes?.alt
							) {
								elementInfo += ` alt="${testResult.attributes.alt}"`;
							}
						} else {
							// Fallback for other elements
							elementInfo =
								testResult.element || "Unknown element";
						}

						// Get action type
						const action = testResult.action || "unknown";

						// Add to data array
						uiData.push([
							elementInfo,
							action,
							testResult.status || "unknown",
						]);
					});
				}

				const uiWS = XLSX.utils.aoa_to_sheet(uiData);

				// Set column widths for UI sheet
				const uiColWidths = [{ wch: 60 }, { wch: 15 }, { wch: 15 }];
				uiWS["!cols"] = uiColWidths;

				XLSX.utils.book_append_sheet(wb, uiWS, "UI Test Details");
			}

			// Create a safe filename based on the URL
			const safeUrl = result.url
				.replace(/[^a-z0-9]/gi, "_")
				.substring(0, 30);
			const timestamp = new Date()
				.toISOString()
				.replace(/:/g, "-")
				.substring(0, 19);
			const filename = `${result.type}_test_result_${safeUrl}_${timestamp}.xlsx`;

			// Write to file and download
			XLSX.writeFile(wb, filename);
			toast.success("Test results downloaded successfully");
		} catch (error) {
			console.error("Error exporting to Excel:", error);
			toast.error("Failed to download test results");
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<Spinner size="lg" />
			</div>
		);
	}

	return (
		<Card className="min-h-[calc(100vh-80px)] flex flex-col">
			<CardHeader>
				<CardTitle>Test Results</CardTitle>
				<CardDescription>
					View the results of your automated tests
				</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 overflow-auto">
				{loading ? (
					<div className="flex justify-center items-center h-64">
						<Spinner size="lg" />
					</div>
				) : (
					<>
						<div className="mb-4 flex flex-col md:flex-row gap-4">
							<div className="flex items-center space-x-2">
								<Badge
									variant={
										filter === "all" ? "default" : "outline"
									}
									className="cursor-pointer hover:bg-muted"
									onClick={() => setFilter("all")}
								>
									All
								</Badge>
								<Badge
									variant={
										filter === "api" ? "default" : "outline"
									}
									className="cursor-pointer hover:bg-muted"
									onClick={() => setFilter("api")}
								>
									API
								</Badge>
								<Badge
									variant={
										filter === "ui" ? "default" : "outline"
									}
									className="cursor-pointer hover:bg-muted"
									onClick={() => setFilter("ui")}
								>
									UI
								</Badge>
								<Badge
									variant={
										filter === "e2e" ? "default" : "outline"
									}
									className="cursor-pointer hover:bg-muted"
									onClick={() => setFilter("e2e")}
								>
									E2E
								</Badge>

								{/* Add refresh button */}
								<Button
									variant="outline"
									size="icon"
									onClick={fetchResults}
									title="Refresh results"
								>
									<RefreshCw className="h-4 w-4" />
								</Button>
							</div>
							<Input
								placeholder="Search by URL..."
								className="w-full md:w-64"
								value={searchQuery}
								onChange={(e) => {
									setSearchQuery(e.target.value);
									setCurrentPage(1);
								}}
							/>
						</div>

						{filteredResults.length === 0 ? (
							<div className="text-center py-8 text-muted-foreground">
								No results found.
							</div>
						) : (
							<>
								<div className="border rounded-md overflow-auto">
									<table className="w-full">
										<thead>
											<tr className="bg-muted">
												<th className="p-2 text-left">
													URL/Name
												</th>
												<th className="p-2 text-left">
													Type
												</th>
												<th className="p-2 text-left">
													Status
												</th>
												<th className="p-2 text-left">
													Date
												</th>
												<th className="p-2 text-left">
													Pass Rate/Progress
												</th>
												<th className="p-2 text-left">
													Actions
												</th>
											</tr>
										</thead>
										<tbody>
											{paginatedResults.map(
												(result, index) => (
													<tr
														key={index}
														className="border-b hover:bg-muted/50 cursor-pointer"
														onClick={() =>
															handleResultClick(
																result
															)
														}
													>
														<td className="p-2">
															<div className="relative group">
																{/* For batch tests, show name */}
																{result.type ===
																"api-batch" ? (
																	<span className="flex items-center">
																		<Badge
																			variant="outline"
																			className="mr-2"
																		>
																			Batch
																		</Badge>
																		{result.name ||
																			"API Batch Test"}
																		{/* Show count of endpoints if available */}
																		{result.totalEndpoints && (
																			<span className="text-xs text-muted-foreground ml-2">
																				(
																				{
																					result.totalEndpoints
																				}{" "}
																				endpoints)
																			</span>
																		)}
																	</span>
																) : result.name ===
																  "Unified API Test" ? (
																	<span className="flex items-center">
																		<Badge
																			variant="outline"
																			className="mr-2"
																		>
																			Unified
																		</Badge>
																		{
																			result.name
																		}
																		{/* Show count of endpoints if available */}
																		{result.totalEndpoints && (
																			<span className="text-xs text-muted-foreground ml-2">
																				(
																				{
																					result.totalEndpoints
																				}{" "}
																				endpoints)
																			</span>
																		)}
																		{/* Show method groups if available */}
																		{result.endpointGroups && (
																			<span className="text-xs text-muted-foreground ml-2">
																				[
																				{Object.entries(
																					result.endpointGroups
																				)
																					.filter(
																						([
																							_,
																							count,
																						]) =>
																							Number(
																								count
																							) >
																							0
																					)
																					.map(
																						([
																							method,
																							count,
																						]) =>
																							`${method}: ${count}`
																					)
																					.join(
																						", "
																					)}

																				]
																			</span>
																		)}
																	</span>
																) : (
																	// For regular tests, show URL
																	<>
																		{result.url &&
																		result
																			.url
																			.length >
																			40 ? (
																			<>
																				<span>
																					{result.url.substring(
																						0,
																						40
																					)}
																					<span className="text-primary">
																						...
																					</span>
																				</span>
																				<div className="absolute left-0 top-full mt-1 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 invisible group-hover:visible">
																					<div className="bg-popover shadow-md rounded-md p-2 text-sm border max-w-md break-all">
																						{
																							result.url
																						}
																					</div>
																				</div>
																			</>
																		) : (
																			result.url
																		)}
																	</>
																)}
															</div>
														</td>
														<td className="p-2 capitalize">
															{result.type ===
															"api-batch"
																? "API Batch"
																: result.type}
														</td>
														<td className="p-2">
															<Badge
																variant={
																	result.status ===
																	"completed"
																		? "success"
																		: result.status ===
																		  "running"
																		? "default"
																		: "destructive"
																}
															>
																{result.status}
															</Badge>
														</td>
														<td className="p-2">
															{new Date(
																result.date
															).toLocaleString()}
														</td>
														<td className="p-2">
															{result.type ===
															"api-batch" ? (
																// For batch tests, show completion progress
																<span>
																	{result.completedEndpoints !==
																		undefined &&
																	result.totalEndpoints !==
																		undefined
																		? `${
																				result.completedEndpoints
																		  }/${
																				result.totalEndpoints
																		  } (${Math.round(
																				(result.completedEndpoints /
																					result.totalEndpoints) *
																					100
																		  )}%)`
																		: "N/A"}
																</span>
															) : result.name ===
																	"Unified API Test" &&
															  result.status ===
																	"running" ? (
																// For unified tests in progress, show completion progress
																<span>
																	{result.completedEndpoints !==
																		undefined &&
																	result.totalEndpoints !==
																		undefined
																		? `${
																				result.completedEndpoints ||
																				0
																		  }/${
																				result.totalEndpoints
																		  } (${Math.round(
																				((result.completedEndpoints ||
																					0) /
																					result.totalEndpoints) *
																					100
																		  )}%)`
																		: "In progress..."}
																</span>
															) : (
																// For regular tests, show pass rate
																<span>
																	{result.passRate !==
																		undefined &&
																	result.passRate !==
																		null
																		? `${result.passRate.toFixed(
																				1
																		  )}%`
																		: "N/A"}
																</span>
															)}
														</td>
														<td className="p-2">
															<div className="flex space-x-1">
																<Button
																	variant="ghost"
																	size="icon"
																	onClick={(
																		e
																	) =>
																		handleDownload(
																			e,
																			result
																		)
																	}
																	className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
																	title="Download test result"
																>
																	<Download className="h-4 w-4" />
																</Button>
																<Button
																	variant="ghost"
																	size="icon"
																	onClick={(
																		e
																	) =>
																		handleDelete(
																			e,
																			result
																		)
																	}
																	className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
																	title="Delete test result"
																>
																	<Trash2 className="h-4 w-4" />
																</Button>
															</div>
														</td>
													</tr>
												)
											)}
										</tbody>
									</table>
								</div>

								<div className="flex justify-between items-center mt-4">
									<div className="text-sm text-muted-foreground">
										Showing {paginatedResults.length} of{" "}
										{filteredResults.length} results
									</div>
									<div className="flex space-x-2">
										<Button
											variant="outline"
											size="sm"
											onClick={() =>
												setCurrentPage((prev) =>
													Math.max(prev - 1, 1)
												)
											}
											disabled={currentPage === 1}
										>
											Previous
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() =>
												setCurrentPage((prev) =>
													Math.min(
														prev + 1,
														totalPages
													)
												)
											}
											disabled={
												currentPage === totalPages
											}
										>
											Next
										</Button>
									</div>
								</div>
							</>
						)}
					</>
				)}

				{selectedResult && (
					<TestResultDetails
						result={selectedResult}
						open={showDetails}
						onOpenChange={setShowDetails}
					/>
				)}
			</CardContent>

			<DeleteConfirmDialog
				isOpen={deleteConfirmOpen}
				onClose={() => setDeleteConfirmOpen(false)}
				onConfirm={confirmDelete}
				title="Delete Test Result"
				description={
					resultToDelete
						? `Are you sure you want to delete the test result for "${resultToDelete.url}"?`
						: "Are you sure you want to delete this test result?"
				}
			/>
		</Card>
	);
}
