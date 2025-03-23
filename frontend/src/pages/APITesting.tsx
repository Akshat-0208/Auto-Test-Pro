import { useState, useEffect } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Trash2, Download, ArrowRight } from "lucide-react";
import axios from "axios";

interface ApiEndpoint {
	id: string;
	name: string;
	path: string;
	method: string;
	requestBody?: string;
	headers?: Record<string, string>;
}

interface Environment {
	id: string;
	name: string;
	baseUrl: string;
	endpoints: ApiEndpoint[];
}

interface BatchTestResult {
	endpoint: string;
	path: string;
	method: string;
	testId?: string;
	status: string;
	error?: string;
}

const APITesting = () => {
	const [loading, setLoading] = useState(false);
	const [activeTab, setActiveTab] = useState("environments");
	const [environments, setEnvironments] = useState<Environment[]>([]);
	const [selectedEnvironment, setSelectedEnvironment] = useState<string>("");
	const [selectedEndpoint, setSelectedEndpoint] = useState<string>("");

	// Environment form fields
	const [envName, setEnvName] = useState("");
	const [baseUrl, setBaseUrl] = useState("");

	// Endpoint form fields
	const [endpointName, setEndpointName] = useState("");
	const [endpointPath, setEndpointPath] = useState("");
	const [endpointMethod, setEndpointMethod] = useState("GET");
	const [requestBody, setRequestBody] = useState("");
	const [customHeaders, setCustomHeaders] = useState("");

	// Test configuration
	const [testConfig, setTestConfig] = useState({
		testParams: true,
		testHeaders: true,
		testResponseTime: true,
		testErrorCases: true,
		maxRequests: 50,
	});

	// Fetch environments from backend on component mount
	useEffect(() => {
		fetchEnvironments();
	}, []);

	// Add useEffect to log when environments change
	useEffect(() => {
		console.log("Environments state updated:", environments);
	}, [environments]);

	const fetchEnvironments = async () => {
		console.log("Attempting to fetch environments...");
		try {
			const response = await axios.get(
				"http://localhost:5000/api/environments"
			);
			console.log("Environments fetched successfully:", response.data);

			if (Array.isArray(response.data)) {
				setEnvironments(response.data);
			} else {
				console.error("Unexpected response format:", response.data);
				toast.error("Unexpected response format from server");
			}
		} catch (error: any) {
			console.error("Error fetching environments:", error);
			if (error.response) {
				console.error("Response data:", error.response.data);
				console.error("Response status:", error.response.status);
			}
			toast.error(`Failed to load environments: ${error.message}`);
		}
	};

	// Helper functions
	const generateId = () => {
		return Math.random().toString(36).substring(2, 9);
	};

	const getSelectedEnvironment = () => {
		return environments.find((env) => env.id === selectedEnvironment);
	};

	const getSelectedEndpoint = () => {
		const env = getSelectedEnvironment();
		if (!env) return null;
		return env.endpoints.find(
			(endpoint) => endpoint.id === selectedEndpoint
		);
	};

	const resetEndpointForm = () => {
		setEndpointName("");
		setEndpointPath("");
		setEndpointMethod("GET");
		setRequestBody("");
		setCustomHeaders("");
	};

	// Environment management
	const handleAddEnvironment = async () => {
		if (!envName || !baseUrl) {
			toast.error("Environment name and base URL are required");
			return;
		}

		setLoading(true);

		try {
			console.log("Adding new environment:", { name: envName, baseUrl });

			// Prepare environment data
			const environmentData = {
				name: envName,
				baseUrl: baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl,
				endpoints: [],
			};

			// Save to backend
			const response = await axios.post(
				"http://localhost:5000/api/environments",
				environmentData
			);
			console.log("Environment added response:", response.data);

			// Refresh environments from server
			await fetchEnvironments();

			setEnvName("");
			setBaseUrl("");
			toast.success(`Environment "${envName}" added`);
		} catch (error: any) {
			console.error("Error adding environment:", error);
			if (error.response) {
				console.error("Response data:", error.response.data);
				console.error("Response status:", error.response.status);
			}
			toast.error(`Failed to add environment: ${error.message}`);
		} finally {
			setLoading(false);
		}
	};

	const handleDeleteEnvironment = async (envId: string) => {
		setLoading(true);

		try {
			// Delete from backend
			await axios.delete(
				`http://localhost:5000/api/environments/${envId}`
			);

			// Update local state
			setEnvironments(environments.filter((env) => env.id !== envId));
			if (selectedEnvironment === envId) {
				setSelectedEnvironment("");
				setSelectedEndpoint("");
			}
			toast.success("Environment deleted");
		} catch (error: any) {
			console.error("Error deleting environment:", error);
			toast.error("Failed to delete environment");
		} finally {
			setLoading(false);
		}
	};

	// Endpoint management
	const handleAddEndpoint = async () => {
		if (!selectedEnvironment) {
			toast.error("Please select an environment first");
			return;
		}

		if (!endpointName) {
			toast.error("Endpoint name is required");
			return;
		}

		// Allow empty path to be treated as "/"
		const processedPath =
			endpointPath.trim() === ""
				? "/"
				: endpointPath.startsWith("/")
				? endpointPath
				: `/${endpointPath}`;

		// Parse custom headers if provided
		let headers: Record<string, string> = {};
		try {
			if (customHeaders.trim()) {
				headers = JSON.parse(customHeaders);
			}
		} catch (error: any) {
			toast.error("Invalid JSON format for headers");
			return;
		}

		setLoading(true);

		try {
			const newEndpoint: ApiEndpoint = {
				id: generateId(),
				name: endpointName,
				path: processedPath,
				method: endpointMethod,
				requestBody: endpointMethod !== "GET" ? requestBody : undefined,
				headers: Object.keys(headers).length > 0 ? headers : undefined,
			};

			const updatedEnvironments = environments?.map((env) => {
				if (env.id === selectedEnvironment) {
					return {
						...env,
						endpoints: [...env.endpoints, newEndpoint],
					};
				}
				return env;
			});

			// Find the environment to update
			const environmentToUpdate = environments.find(
				(env) => env.id === selectedEnvironment
			);

			if (environmentToUpdate) {
				// Update the environment on the backend
				await axios.put(
					`http://localhost:5000/api/environments/${selectedEnvironment}`,
					{
						endpoints: [
							...environmentToUpdate.endpoints,
							newEndpoint,
						],
					}
				);

				// Update local state
				setEnvironments(updatedEnvironments);
				resetEndpointForm();
				toast.success(`Endpoint "${endpointName}" added`);
			}
		} catch (error: any) {
			console.error("Error adding endpoint:", error);
			toast.error("Failed to add endpoint");
		} finally {
			setLoading(false);
		}
	};

	const handleDeleteEndpoint = async (envId: string, endpointId: string) => {
		setLoading(true);

		try {
			// Find the environment to update
			const environmentToUpdate = environments.find(
				(env) => env.id === envId
			);

			if (environmentToUpdate) {
				// Filter out the endpoint to delete
				const updatedEndpoints = environmentToUpdate.endpoints.filter(
					(ep) => ep.id !== endpointId
				);

				// Update the environment on the backend
				await axios.put(
					`http://localhost:5000/api/environments/${envId}`,
					{
						endpoints: updatedEndpoints,
					}
				);

				// Update local state
				const updatedEnvironments = environments?.map((env) => {
					if (env.id === envId) {
						return {
							...env,
							endpoints: updatedEndpoints,
						};
					}
					return env;
				});

				setEnvironments(updatedEnvironments);
				if (selectedEndpoint === endpointId) {
					setSelectedEndpoint("");
				}
				toast.success("Endpoint deleted");
			}
		} catch (error: any) {
			console.error("Error deleting endpoint:", error);
			toast.error("Failed to delete endpoint");
		} finally {
			setLoading(false);
		}
	};

	const handleUpdateEndpoint = async () => {
		if (!selectedEnvironment || !selectedEndpoint) {
			toast.error("No endpoint selected");
			return;
		}

		try {
			let headers: Record<string, string> | undefined = undefined;

			if (customHeaders.trim()) {
				try {
					headers = JSON.parse(customHeaders);
				} catch (error: any) {
					toast.error("Invalid JSON format for headers");
					return;
				}
			}

			setLoading(true);

			// Find the environment to update
			const environmentToUpdate = environments.find(
				(env) => env.id === selectedEnvironment
			);

			if (environmentToUpdate) {
				// Update the specific endpoint
				const updatedEndpoints = environmentToUpdate.endpoints?.map(
					(ep) => {
						if (ep.id === selectedEndpoint) {
							return {
								...ep,
								requestBody:
									ep.method !== "GET"
										? requestBody
										: undefined,
								headers: headers,
							};
						}
						return ep;
					}
				);

				// Update the environment on the backend
				await axios.put(
					`http://localhost:5000/api/environments/${selectedEnvironment}`,
					{
						endpoints: updatedEndpoints,
					}
				);

				// Update local state
				const updatedEnvironments = environments?.map((env) => {
					if (env.id === selectedEnvironment) {
						return {
							...env,
							endpoints: updatedEndpoints,
						};
					}
					return env;
				});

				setEnvironments(updatedEnvironments);
				toast.success("Endpoint details updated");
			}
		} catch (error: any) {
			console.error("Error updating endpoint:", error);
			toast.error("Failed to update endpoint");
		} finally {
			setLoading(false);
		}
	};

	const handleCheckboxChange = (key: string) => (checked: boolean) => {
		setTestConfig((prev) => ({
			...prev,
			[key]: checked,
		}));
	};

	// Setup endpoint details when selecting an endpoint
	useEffect(() => {
		const endpoint = getSelectedEndpoint();
		if (endpoint) {
			setEndpointName(endpoint.name);
			setEndpointPath(endpoint.path);
			setEndpointMethod(endpoint.method);
			setRequestBody(endpoint.requestBody || "");
			setCustomHeaders(
				endpoint.headers
					? JSON.stringify(endpoint.headers, null, 2)
					: ""
			);
		} else {
			resetEndpointForm();
		}
	}, [selectedEndpoint]);

	// Test execution
	const handleRunTest = async () => {
		const env = getSelectedEnvironment();
		const endpoint = getSelectedEndpoint();

		if (!env || !endpoint) {
			toast.error("Please select an environment and endpoint");
			return;
		}

		setLoading(true);

		const fullUrl = `${env.baseUrl}${endpoint.path}`;

		try {
			const response = await axios.post(
				"http://localhost:5000/api/api-test",
				{
					endpoint: fullUrl,
					config: {
						...testConfig,
						method: endpoint.method,
						requestBody: endpoint.requestBody,
						headers: endpoint.headers,
					},
				}
			);

			toast.success("API tests started successfully");
			setActiveTab("results");
			console.log(response.data);
		} catch (error: any) {
			toast.error("Failed to start API tests");
			console.error(error);
		} finally {
			setLoading(false);
		}
	};

	// Add a new function to test all endpoints in the selected environment
	const handleBatchTest = async () => {
		const env = getSelectedEnvironment();

		if (!env) {
			toast.error("Please select an environment first");
			return;
		}

		if (env.endpoints.length === 0) {
			toast.error("No endpoints to test in this environment");
			return;
		}

		setLoading(true);

		try {
			toast.info(
				`Starting batch test of ${env.endpoints.length} endpoints in ${env.name}`
			);

			// Prepare endpoints for batch testing
			const endpointData = env.endpoints.map((endpoint) => ({
				url: `${env.baseUrl}${endpoint.path}`,
				method: endpoint.method,
				requestBody: endpoint.requestBody,
				headers: endpoint.headers,
				name: endpoint.name,
			}));

			// Call the unified API test endpoint
			const response = await axios.post(
				"http://localhost:5000/api/unified-api-test",
				{
					endpoints: endpointData,
					config: {
						...testConfig,
						// Common config for all endpoints
						testParams: testConfig.testParams,
						testHeaders: testConfig.testHeaders,
						testResponseTime: testConfig.testResponseTime,
						testErrorCases: testConfig.testErrorCases,
						maxRequests: testConfig.maxRequests,
					},
				}
			);

			const { testId } = response.data;

			toast.success(
				`Started unified test with ${endpointData.length} endpoints. Waiting for results...`
			);

			// Poll for test completion
			let testCompleted = false;
			let attempts = 0;
			const maxAttempts = 60; // Increase to 60 attempts (1 minute)

			while (!testCompleted && attempts < maxAttempts) {
				attempts++;
				await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

				try {
					// Fetch results to check test status
					const resultsResponse = await axios.get(
						"http://localhost:5000/api/results"
					);
					const results = resultsResponse.data;

					// Find our test
					const testResult = results.find(
						(r: any) => r.testId === testId
					);

					if (testResult) {
						// Check if test is completed
						if (
							testResult.status === "completed" ||
							testResult.status === "failed"
						) {
							testCompleted = true;
							toast.success(
								`Test completed with status: ${testResult.status}`
							);
						} else {
							// Log progress every 5 seconds
							if (attempts % 5 === 0) {
								toast.info(
									`Test is still running (attempt ${attempts}/${maxAttempts})...`
								);
								console.log(
									`Test ${testId} status: ${testResult.status}`
								);
							}
						}
					}
				} catch (error) {
					console.error("Error checking test status:", error);
				}
			}

			// Add a final check before giving up
			if (!testCompleted) {
				try {
					await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait 3 more seconds

					const finalCheckResponse = await axios.get(
						"http://localhost:5000/api/results"
					);
					const finalResults = finalCheckResponse.data;
					const finalTestResult = finalResults.find(
						(r: any) => r.testId === testId
					);

					if (
						finalTestResult &&
						(finalTestResult.status === "completed" ||
							finalTestResult.status === "failed")
					) {
						testCompleted = true;
						toast.success(
							`Test completed with status: ${finalTestResult.status}`
						);
					} else {
						toast.info(
							"Test may still be running. Proceeding to results page..."
						);
					}
				} catch (error) {
					console.error("Error in final status check:", error);
				}
			}

			// Navigate to Results page
			window.location.href = `/results?id=${testId}`;
		} catch (error: any) {
			console.error("Batch test error:", error);
			toast.error(`Failed to run batch tests: ${error.message}`);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="container mx-auto py-8">
			<Card>
				<CardHeader>
					<CardTitle>API Testing Environment</CardTitle>
					<CardDescription>
						Configure environments and test API endpoints
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Tabs value={activeTab} onValueChange={setActiveTab}>
						<TabsList className="grid w-full grid-cols-2">
							<TabsTrigger value="environments">
								Environments
							</TabsTrigger>
							<TabsTrigger value="testing">
								Test Configuration
							</TabsTrigger>
						</TabsList>

						<TabsContent value="environments" className="space-y-6">
							{/* Environment Setup Section */}
							<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
								{/* Environment List */}
								<div className="col-span-1 border rounded-md p-4">
									<h3 className="text-sm font-medium mb-4">
										Environments
									</h3>
									{environments.length === 0 ? (
										<div className="text-sm text-muted-foreground">
											No environments added yet
										</div>
									) : (
										<div className="space-y-2">
											{environments?.map((env) => (
												<div
													key={env.id}
													className={`flex justify-between items-center p-2 rounded-md cursor-pointer ${
														selectedEnvironment ===
														env.id
															? "bg-muted"
															: "hover:bg-muted/50"
													}`}
													onClick={() =>
														setSelectedEnvironment(
															env.id
														)
													}
												>
													<div>
														<div className="font-medium">
															{env.name}
														</div>
														<div className="text-xs text-muted-foreground">
															{env.baseUrl}
														</div>
													</div>
													<Button
														variant="ghost"
														size="icon"
														onClick={(e) => {
															e.stopPropagation();
															handleDeleteEnvironment(
																env.id
															);
														}}
													>
														<Trash2 className="h-4 w-4 text-muted-foreground" />
													</Button>
												</div>
											))}
										</div>
									)}

									{/* Add Environment Form */}
									<div className="mt-4 space-y-2">
										<h4 className="text-xs font-medium">
											Add Environment
										</h4>
										<Input
											placeholder="Environment Name"
											value={envName}
											onChange={(e) =>
												setEnvName(e.target.value)
											}
										/>
										<Input
											placeholder="Base URL (https://api.example.com)"
											value={baseUrl}
											onChange={(e) =>
												setBaseUrl(e.target.value)
											}
										/>
										<Button
											className="w-full"
											variant="outline"
											onClick={handleAddEnvironment}
										>
											<PlusCircle className="h-4 w-4 mr-2" />
											Add Environment
										</Button>
									</div>
								</div>

								{/* Endpoints List */}
								<div className="col-span-1 border rounded-md p-4">
									<h3 className="text-sm font-medium mb-4">
										Endpoints
									</h3>

									{!selectedEnvironment ? (
										<div className="text-sm text-muted-foreground">
											Select an environment first
										</div>
									) : getSelectedEnvironment()?.endpoints
											.length === 0 ? (
										<div className="text-sm text-muted-foreground">
											No endpoints added yet
										</div>
									) : (
										<div className="space-y-2">
											{getSelectedEnvironment()?.endpoints?.map(
												(endpoint) => (
													<div
														key={endpoint.id}
														className={`flex justify-between items-center p-2 rounded-md cursor-pointer ${
															selectedEndpoint ===
															endpoint.id
																? "bg-muted"
																: "hover:bg-muted/50"
														}`}
														onClick={() =>
															setSelectedEndpoint(
																endpoint.id
															)
														}
													>
														<div className="flex-1">
															<div className="font-medium flex items-center">
																<span
																	className={`
																px-2 py-0.5 text-xs rounded mr-2
																${
																	endpoint.method ===
																	"GET"
																		? "bg-green-100 text-green-800"
																		: endpoint.method ===
																		  "POST"
																		? "bg-blue-100 text-blue-800"
																		: endpoint.method ===
																		  "PUT"
																		? "bg-yellow-100 text-yellow-800"
																		: endpoint.method ===
																		  "DELETE"
																		? "bg-red-100 text-red-800"
																		: "bg-gray-100 text-gray-800"
																}
															`}
																>
																	{
																		endpoint.method
																	}
																</span>
																{endpoint.name}
															</div>
															<div className="text-xs text-muted-foreground truncate">
																{endpoint.path}
															</div>
														</div>
														<Button
															variant="ghost"
															size="icon"
															onClick={(e) => {
																e.stopPropagation();
																handleDeleteEndpoint(
																	selectedEnvironment,
																	endpoint.id
																);
															}}
														>
															<Trash2 className="h-4 w-4 text-muted-foreground" />
														</Button>
													</div>
												)
											)}
										</div>
									)}

									{/* Add Endpoint Form */}
									{selectedEnvironment && (
										<div className="mt-4 space-y-2">
											<h4 className="text-xs font-medium">
												Add Endpoint
											</h4>
											<Input
												placeholder="Endpoint Name"
												value={endpointName}
												onChange={(e) =>
													setEndpointName(
														e.target.value
													)
												}
											/>
											<Input
												placeholder="Path (/ for root or /users/123)"
												value={endpointPath}
												onChange={(e) =>
													setEndpointPath(
														e.target.value
													)
												}
											/>
											<Select
												value={endpointMethod}
												onValueChange={
													setEndpointMethod
												}
											>
												<SelectTrigger>
													<SelectValue placeholder="Method" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="GET">
														GET
													</SelectItem>
													<SelectItem value="POST">
														POST
													</SelectItem>
													<SelectItem value="PUT">
														PUT
													</SelectItem>
													<SelectItem value="PATCH">
														PATCH
													</SelectItem>
													<SelectItem value="DELETE">
														DELETE
													</SelectItem>
												</SelectContent>
											</Select>
											<Button
												className="w-full"
												variant="outline"
												onClick={handleAddEndpoint}
											>
												<PlusCircle className="h-4 w-4 mr-2" />
												Add Endpoint
											</Button>
										</div>
									)}
								</div>

								{/* Endpoint Details */}
								<div className="col-span-1 border rounded-md p-4">
									<h3 className="text-sm font-medium mb-4">
										Endpoint Details
									</h3>

									{!selectedEndpoint ? (
										<div className="text-sm text-muted-foreground">
											Select an endpoint to view details
										</div>
									) : (
										<>
											{getSelectedEndpoint()?.method !==
												"GET" && (
												<div className="space-y-2 mb-4">
													<Label htmlFor="requestBody">
														Request Body (JSON)
													</Label>
													<Textarea
														id="requestBody"
														placeholder='{"key": "value"}'
														value={requestBody}
														onChange={(e) =>
															setRequestBody(
																e.target.value
															)
														}
														rows={5}
													/>
												</div>
											)}

											<div className="space-y-2">
												<Label htmlFor="headers">
													Custom Headers (JSON)
												</Label>
												<Textarea
													id="headers"
													placeholder='{"Content-Type": "application/json"}'
													value={customHeaders}
													onChange={(e) =>
														setCustomHeaders(
															e.target.value
														)
													}
													rows={3}
												/>
											</div>

											<div className="mt-4">
												<Button
													className="w-full"
													onClick={
														handleUpdateEndpoint
													}
												>
													Update Endpoint
												</Button>
											</div>
										</>
									)}
								</div>
							</div>
						</TabsContent>

						<TabsContent value="testing" className="space-y-6">
							<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
								{/* Environment & Endpoint Selection */}
								<div className="col-span-1 md:col-span-3 border rounded-md p-4">
									<div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
										<div className="w-full md:w-auto">
											<Label
												htmlFor="envSelect"
												className="mr-2"
											>
												Environment:
											</Label>
											<Select
												value={selectedEnvironment}
												onValueChange={
													setSelectedEnvironment
												}
											>
												<SelectTrigger
													id="envSelect"
													className="w-[200px]"
												>
													<SelectValue placeholder="Select Environment" />
												</SelectTrigger>
												<SelectContent>
													{environments?.map(
														(env) => (
															<SelectItem
																key={env.id}
																value={env.id}
															>
																{env.name}
															</SelectItem>
														)
													)}
												</SelectContent>
											</Select>
										</div>

										<div className="w-full md:w-auto">
											<Label
												htmlFor="endpointSelect"
												className="mr-2"
											>
												Endpoint:
											</Label>
											<Select
												value={selectedEndpoint}
												onValueChange={
													setSelectedEndpoint
												}
												disabled={!selectedEnvironment}
											>
												<SelectTrigger
													id="endpointSelect"
													className="w-[200px]"
												>
													<SelectValue placeholder="Select Endpoint" />
												</SelectTrigger>
												<SelectContent>
													{getSelectedEnvironment()?.endpoints?.map(
														(endpoint) => (
															<SelectItem
																key={
																	endpoint.id
																}
																value={
																	endpoint.id
																}
															>
																{endpoint.name}
															</SelectItem>
														)
													)}
												</SelectContent>
											</Select>
										</div>

										{selectedEnvironment &&
											selectedEndpoint && (
												<div className="flex-1 bg-muted rounded p-2 text-sm">
													<span
														className={`
													px-2 py-0.5 text-xs rounded mr-2
													${
														getSelectedEndpoint()
															?.method === "GET"
															? "bg-green-100 text-green-800"
															: getSelectedEndpoint()
																	?.method ===
															  "POST"
															? "bg-blue-100 text-blue-800"
															: getSelectedEndpoint()
																	?.method ===
															  "PUT"
															? "bg-yellow-100 text-yellow-800"
															: getSelectedEndpoint()
																	?.method ===
															  "DELETE"
															? "bg-red-100 text-red-800"
															: "bg-gray-100 text-gray-800"
													}
												`}
													>
														{
															getSelectedEndpoint()
																?.method
														}
													</span>
													<span className="font-mono">
														{
															getSelectedEnvironment()
																?.baseUrl
														}
														{
															getSelectedEndpoint()
																?.path
														}
													</span>
												</div>
											)}
									</div>
								</div>

								{/* Test Configuration */}
								<div className="col-span-1 md:col-span-2 border rounded-md p-4">
									<h3 className="text-sm font-medium mb-4">
										Test Configuration
									</h3>

									<div className="space-y-4">
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
											<div className="flex items-center space-x-2">
												<Checkbox
													id="testParams"
													checked={
														testConfig.testParams
													}
													onCheckedChange={handleCheckboxChange(
														"testParams"
													)}
												/>
												<Label htmlFor="testParams">
													Test Query Parameters
												</Label>
											</div>

											<div className="flex items-center space-x-2">
												<Checkbox
													id="testHeaders"
													checked={
														testConfig.testHeaders
													}
													onCheckedChange={handleCheckboxChange(
														"testHeaders"
													)}
												/>
												<Label htmlFor="testHeaders">
													Test Headers
												</Label>
											</div>

											<div className="flex items-center space-x-2">
												<Checkbox
													id="testResponseTime"
													checked={
														testConfig.testResponseTime
													}
													onCheckedChange={handleCheckboxChange(
														"testResponseTime"
													)}
												/>
												<Label htmlFor="testResponseTime">
													Test Response Time
												</Label>
											</div>

											<div className="flex items-center space-x-2">
												<Checkbox
													id="testErrorCases"
													checked={
														testConfig.testErrorCases
													}
													onCheckedChange={handleCheckboxChange(
														"testErrorCases"
													)}
												/>
												<Label htmlFor="testErrorCases">
													Test Error Cases
												</Label>
											</div>
										</div>

										<div className="space-y-2">
											<div className="flex justify-between">
												<Label htmlFor="maxRequests">
													Max Requests:{" "}
													{testConfig.maxRequests}
												</Label>
											</div>
											<Slider
												id="maxRequests"
												min={10}
												max={200}
												step={10}
												value={[testConfig.maxRequests]}
												onValueChange={(values) =>
													setTestConfig((prev) => ({
														...prev,
														maxRequests: values[0],
													}))
												}
											/>
										</div>
									</div>
								</div>

								{/* Run Test Button */}
								<div className="col-span-1 border rounded-md p-4">
									<h3 className="text-sm font-medium mb-4">
										Run Tests
									</h3>
									<div className="space-y-4">
										<div className="text-sm text-muted-foreground mb-4">
											Run API tests against the selected
											endpoint or test all endpoints in
											the environment.
										</div>
										<div className="grid grid-cols-1 gap-3">
											<Button
												className="w-full"
												size="lg"
												disabled={
													loading ||
													!selectedEnvironment ||
													!selectedEndpoint
												}
												onClick={handleRunTest}
											>
												{loading
													? "Starting Tests..."
													: "Test Selected Endpoint"}
												<ArrowRight className="ml-2 h-4 w-4" />
											</Button>

											<Button
												className="w-full"
												variant="outline"
												size="lg"
												disabled={
													loading ||
													!selectedEnvironment
												}
												onClick={handleBatchTest}
											>
												{loading
													? "Starting Tests..."
													: "Test All Endpoints"}
												<Download className="ml-2 h-4 w-4" />
											</Button>
										</div>
									</div>
								</div>
							</div>
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>
		</div>
	);
};

export default APITesting;
