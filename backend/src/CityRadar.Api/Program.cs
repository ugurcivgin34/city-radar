var builder = WebApplication.CreateBuilder(args);

var app = builder.Build();

// Composition root. No endpoints yet (spec 0001): business endpoints, OpenAPI and
// ProblemDetails arrive with the first endpoint feature.
app.Run();
