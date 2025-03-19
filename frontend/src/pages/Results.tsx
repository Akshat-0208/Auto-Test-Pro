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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { TestResultDetails } from "@/components/TestResultDetails";
import { Download, Trash2 } from "lucide-react";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import * as XLSX from "xlsx";

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

			// Map the results to ensure each has a consistent ID property
			const processedResults = response.data.map((result: any) => {
				// Try to find an ID property - MongoDB might return _id
				let id = null;
				if (result._id) id = result._id;
				else if (result.id) id = result.id;
				else if (result.testId) id = result.testId;

				// If we found an ID, make sure it's available as both _id and id
				if (id) {
					return {
						...result,
						_id: id, // Ensure _id exists
						id: id, // Ensure id exists
					};
				}

				// If no ID found, just return the original object
				return result;
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

	// Add effect to clear selected result when dialog closes
	useEffect(() => {
		if (!showDetails) {
			setSelectedResult(null);
		}
	}, [showDetails]);

	const filteredResults = results.filter((result) => {
		const matchesFilter = filter === "all" || result.type === filter;
		const matchesSearch = result.url
			.toLowerCase()
			.includes(searchQuery.toLowerCase());
		return matchesFilter && matchesSearch;
	});

	const totalPages = Math.ceil(filteredResults.length / resultsPerPage);
	const paginatedResults = filteredResults.slice(
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

			// Create detailed results sheet
			const detailsHeaders = ["Element", "Action", "Result"];
			const detailsData = [detailsHeaders];

			if (result.testResults && result.testResults.length > 0) {
				result.testResults.forEach((testResult) => {
					// Create meaningful element representation
					let elementInfo = "";
					if (testResult.elementType) {
						// For UI elements
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
					} else if (testResult.endpoint) {
						// For API tests
						elementInfo = `API [${testResult.endpoint}]`;
					} else {
						// Fallback for other elements
						elementInfo = testResult.element || "Unknown element";
					}

					// Get action type
					const action = testResult.action || "unknown";

					// Add to data array
					detailsData.push([
						elementInfo,
						action,
						testResult.status || "unknown",
					]);
				});
			}

			const detailsWS = XLSX.utils.aoa_to_sheet(detailsData);

			// Set column widths
			const colWidths = [{ wch: 60 }, { wch: 15 }, { wch: 15 }];
			detailsWS["!cols"] = colWidths;

			XLSX.utils.book_append_sheet(wb, detailsWS, "Test Details");

			// Create a safe filename based on the URL
			const safeUrl = result.url
				.replace(/[^a-z0-9]/gi, "_")
				.substring(0, 30);
			const timestamp = new Date()
				.toISOString()
				.replace(/:/g, "-")
				.substring(0, 19);
			const filename = `test_result_${safeUrl}_${timestamp}.xlsx`;

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
							<Tabs
								defaultValue="all"
								className="w-full md:w-auto"
								onValueChange={setFilter}
							>
								<TabsList className="grid w-full grid-cols-3">
									<TabsTrigger value="all">All</TabsTrigger>
									<TabsTrigger value="ui">
										UI Tests
									</TabsTrigger>
									<TabsTrigger value="api">
										API Tests
									</TabsTrigger>
								</TabsList>
							</Tabs>
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
													URL
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
													Pass Rate
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
																{result.url
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
															</div>
														</td>
														<td className="p-2 capitalize">
															{result.type}
														</td>
														<td className="p-2">
															<Badge
																variant={
																	result.status ===
																	"completed"
																		? "success"
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
															{result.passRate.toFixed(
																1
															)}
															%
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
