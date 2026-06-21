# ---- build ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY RecrutaBot.Api.csproj ./
RUN dotnet restore RecrutaBot.Api.csproj
COPY . ./
RUN dotnet publish RecrutaBot.Api.csproj -c Release -o /app /p:UseAppHost=false

# ---- runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app ./
# The marked Hays template is copied to the output by the .csproj (Templates/).
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "RecrutaBot.Api.dll"]
